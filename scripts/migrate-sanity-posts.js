/**
 * Sanity → Supabase 포스트 마이그레이션 스크립트
 *
 * 사용법:
 *   node scripts/migrate-sanity-posts.js              # 실행
 *   node scripts/migrate-sanity-posts.js --dry-run    # 실제 DB 삽입 없이 확인만
 *   node scripts/migrate-sanity-posts.js --skip-images # 이미지 업로드 건너뛰기 (테스트용)
 *
 * 기능:
 *   1. Sanity CDN 이미지 125개 → Supabase Storage(posts 버킷) 업로드
 *   2. 마크다운 content → HTML 변환 + URL 교체
 *   3. 28개 포스트 → posts 테이블 삽입
 *   4. 17개 댓글 → post_comments 테이블 삽입
 *   5. like_count, comment_count 유지
 *
 * 주의:
 *   - .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요
 *   - Supabase Storage에 'posts' 버킷이 존재해야 함
 *   - jeonghak.hur@gmail.com 계정이 profiles에 존재해야 함
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// ── 옵션 ──
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_IMAGES = process.argv.includes('--skip-images')

// ── .env.local 로드 ──
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const envFile = fs.readFileSync(envPath, 'utf8')
    const env = {}
    envFile.split('\n').forEach((line) => {
      const parts = line.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        if (key && value && !key.startsWith('#')) {
          env[key] = value
        }
      }
    })
    return env
  } catch (error) {
    console.error('.env.local 파일을 읽을 수 없습니다:', error.message)
    process.exit(1)
  }
}

// ── Supabase 클라이언트 ──
const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 카테고리 매핑 ──
const CATEGORY_MAP = {
  general: 'FREE',
  tournament_rules: 'NOTICE',
}

// ── 이미지 URL 패턴 ──
const IMG_REGEX = /!\[([^\]]*)\]\((https:\/\/cdn\.sanity\.io\/images\/[^)]+)\)/g
const FILE_REGEX = /https:\/\/cdn\.sanity\.io\/files\/[^"'\s]+/g

// ── 이미지 다운로드 + Supabase 업로드 ──
const urlMap = new Map() // sanityUrl → supabaseUrl

async function downloadAndUpload(sanityUrl, index) {
  if (urlMap.has(sanityUrl)) return urlMap.get(sanityUrl)
  if (SKIP_IMAGES) {
    urlMap.set(sanityUrl, sanityUrl)
    return sanityUrl
  }

  try {
    const response = await fetch(sanityUrl)
    if (!response.ok) {
      console.error(`  ❌ 다운로드 실패 [${response.status}]: ${sanityUrl.slice(0, 80)}`)
      urlMap.set(sanityUrl, sanityUrl) // 실패 시 원본 URL 유지
      return sanityUrl
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // 확장자 결정
    const urlPath = new URL(sanityUrl).pathname
    let ext = urlPath.split('.').pop() || 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) ext = 'jpg'

    const fileName = `migration/${Date.now()}-${index}-${Math.random().toString(36).substring(2, 8)}.${ext}`

    if (DRY_RUN) {
      const fakeUrl = `${supabaseUrl}/storage/v1/object/public/posts/${fileName}`
      urlMap.set(sanityUrl, fakeUrl)
      return fakeUrl
    }

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error(`  ❌ 업로드 실패: ${uploadError.message}`)
      urlMap.set(sanityUrl, sanityUrl)
      return sanityUrl
    }

    const { data: { publicUrl } } = supabase.storage
      .from('posts')
      .getPublicUrl(fileName)

    urlMap.set(sanityUrl, publicUrl)
    return publicUrl
  } catch (err) {
    console.error(`  ❌ 오류: ${err.message}`)
    urlMap.set(sanityUrl, sanityUrl)
    return sanityUrl
  }
}

// ── 마크다운 → HTML 변환 ──
function markdownToHtml(content, imageUrlMap) {
  if (!content) return ''

  // 1. 이미지 마크다운 → <img> 태그 (URL 교체 포함)
  let html = content.replace(IMG_REGEX, (_, alt, url) => {
    const newUrl = imageUrlMap.get(url) || url
    return `<img src="${newUrl}" alt="${escapeHtml(alt)}">`
  })

  // 2. **bold** → <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // 3. 줄바꿈 → 단락 구분
  // 연속 이미지 태그 사이의 빈 줄바꿈은 무시
  const lines = html.split('\n')
  const paragraphs = []
  let currentParagraph = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join('<br>'))
        currentParagraph = []
      }
    } else {
      currentParagraph.push(trimmed)
    }
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join('<br>'))
  }

  // 각 단락을 <p>로 감싸되, img만 있는 단락은 <p> 없이
  html = paragraphs
    .map((p) => {
      // img 태그만 포함된 단락
      if (/^(<img [^>]+>)+$/.test(p.replace(/<br>/g, ''))) {
        return p.replace(/<br>/g, '')
      }
      return `<p>${p}</p>`
    })
    .join('')

  return html
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── 메인 ──
async function main() {
  console.log(`\n🎾 Sanity → Supabase 포스트 마이그레이션`)
  console.log(`   모드: ${DRY_RUN ? '🔍 DRY RUN (DB 삽입 없음)' : '🚀 실제 실행'}`)
  console.log(`   이미지: ${SKIP_IMAGES ? '⏭️  건너뛰기' : '📤 업로드'}`)
  console.log()

  // 1. 작성자 profile UUID 조회
  console.log('1️⃣  작성자 프로필 조회...')
  const { data: authorProfile, error: authorError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('email', 'jeonghak.hur@gmail.com')
    .single()

  if (authorError || !authorProfile) {
    console.error('❌ jeonghak.hur@gmail.com 프로필을 찾을 수 없습니다:', authorError?.message)
    process.exit(1)
  }
  console.log(`   ✅ ${authorProfile.name} (${authorProfile.id})`)

  const authorId = authorProfile.id

  // 2. Sanity 데이터 로드
  console.log('\n2️⃣  Sanity 데이터 로드...')
  const dataPath = path.join(__dirname, 'sanity-posts-data.json')
  const sanityData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  console.log(`   포스트: ${sanityData.posts.length}개`)
  console.log(`   댓글: ${sanityData.comments.length}개`)

  // 3. 이미지 수집 및 업로드
  console.log('\n3️⃣  이미지 수집 및 업로드...')
  const allImageUrls = new Set()

  for (const post of sanityData.posts) {
    const content = post.content || ''
    let match
    const regex = new RegExp(IMG_REGEX.source, 'g')
    while ((match = regex.exec(content)) !== null) {
      allImageUrls.add(match[2])
    }
  }

  console.log(`   고유 이미지: ${allImageUrls.size}개`)

  let uploadCount = 0
  const imageArray = [...allImageUrls]
  for (let i = 0; i < imageArray.length; i++) {
    const url = imageArray[i]
    await downloadAndUpload(url, i)
    uploadCount++
    if (uploadCount % 10 === 0 || uploadCount === imageArray.length) {
      process.stdout.write(`   📤 ${uploadCount}/${imageArray.length} 완료\r`)
    }
    // Rate limiting: 100ms 간격
    if (!SKIP_IMAGES && !DRY_RUN) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  console.log(`\n   ✅ 이미지 업로드 완료 (${urlMap.size}개 매핑)`)

  // 3-1. 첨부파일 업로드 (HWP 파일 1개)
  console.log('\n3️⃣-1 첨부파일 업로드...')
  const attachmentUrlMap = new Map()
  for (const post of sanityData.posts) {
    if (post.attachments && post.attachments.length > 0) {
      for (const att of post.attachments) {
        if (att.url && att.url.includes('cdn.sanity.io')) {
          try {
            if (SKIP_IMAGES || DRY_RUN) {
              attachmentUrlMap.set(att.url, att.url)
              continue
            }
            const response = await fetch(att.url)
            if (!response.ok) {
              console.error(`   ❌ 첨부파일 다운로드 실패: ${att.filename}`)
              attachmentUrlMap.set(att.url, att.url)
              continue
            }
            const buffer = Buffer.from(await response.arrayBuffer())
            const ext = att.filename.split('.').pop() || 'bin'
            const fileName = `migration/attachments/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

            const { error: uploadError } = await supabase.storage
              .from('posts')
              .upload(fileName, buffer, {
                contentType: att.type || 'application/octet-stream',
                cacheControl: '3600',
                upsert: false,
              })

            if (uploadError) {
              console.error(`   ❌ 첨부파일 업로드 실패: ${uploadError.message}`)
              attachmentUrlMap.set(att.url, att.url)
              continue
            }

            const { data: { publicUrl } } = supabase.storage
              .from('posts')
              .getPublicUrl(fileName)

            attachmentUrlMap.set(att.url, publicUrl)
            console.log(`   ✅ ${att.filename} 업로드 완료`)
          } catch (err) {
            console.error(`   ❌ 첨부파일 오류: ${err.message}`)
            attachmentUrlMap.set(att.url, att.url)
          }
        }
      }
    }
  }

  // 4. 포스트 삽입
  console.log('\n4️⃣  포스트 삽입...')
  const sanityIdToPostId = new Map() // sanity _id → supabase post id
  let postSuccessCount = 0

  for (const post of sanityData.posts) {
    // content 변환
    const htmlContent = markdownToHtml(post.content || '', urlMap)

    // 카테고리 매핑
    const category = CATEGORY_MAP[post.category] || 'FREE'

    // is_pinned 결정 (mainPriority > 0)
    const isPinned = (post.mainPriority || 0) > 0

    // 첨부파일 변환
    const attachments = (post.attachments || []).map((att) => ({
      url: attachmentUrlMap.get(att.url) || att.url,
      name: att.filename || att.url.split('/').pop(),
      size: att.size || 0,
      type: att.type?.startsWith('image/') ? 'image' : 'document',
    }))

    const insertData = {
      category,
      title: post.title,
      content: htmlContent,
      attachments,
      author_id: authorId,
      view_count: 0,
      comment_count: post.commentCount || 0,
      like_count: post.likeCount || 0,
      is_pinned: isPinned,
      created_at: post.createdAt,
      updated_at: post.updatedAt || post.createdAt,
    }

    if (DRY_RUN) {
      console.log(`   📝 [DRY] ${category} | ${post.title.slice(0, 50)}`)
      sanityIdToPostId.set(post._id, `dry-${postSuccessCount}`)
      postSuccessCount++
      continue
    }

    const { data, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error(`   ❌ 포스트 삽입 실패: ${post.title.slice(0, 40)} → ${error.message}`)
      continue
    }

    sanityIdToPostId.set(post._id, data.id)
    postSuccessCount++
    console.log(`   ✅ ${category} | ${post.title.slice(0, 50)}`)
  }
  console.log(`\n   포스트 ${postSuccessCount}/${sanityData.posts.length}개 삽입 완료`)

  // 5. 댓글 삽입
  console.log('\n5️⃣  댓글 삽입...')
  let commentSuccessCount = 0

  for (const comment of sanityData.comments) {
    const postRef = comment.post?._ref
    const supabasePostId = sanityIdToPostId.get(postRef)

    if (!supabasePostId) {
      console.error(`   ⚠️ 포스트를 찾을 수 없음: ${postRef}`)
      continue
    }

    const insertData = {
      post_id: supabasePostId,
      author_id: authorId, // 모든 댓글도 동일 작성자로
      content: comment.content,
      created_at: comment.createdAt,
      updated_at: comment.updatedAt || comment.createdAt,
    }

    if (DRY_RUN) {
      console.log(`   💬 [DRY] ${comment.content.slice(0, 40)}`)
      commentSuccessCount++
      continue
    }

    const { error } = await supabase
      .from('post_comments')
      .insert(insertData)

    if (error) {
      console.error(`   ❌ 댓글 삽입 실패: ${comment.content.slice(0, 30)} → ${error.message}`)
      continue
    }

    commentSuccessCount++
  }
  console.log(`   댓글 ${commentSuccessCount}/${sanityData.comments.length}개 삽입 완료`)

  // 6. comment_count 동기화
  if (!DRY_RUN) {
    console.log('\n6️⃣  comment_count 동기화...')
    for (const [sanityId, postId] of sanityIdToPostId) {
      const { count } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)

      await supabase
        .from('posts')
        .update({ comment_count: count || 0 })
        .eq('id', postId)
    }
    console.log('   ✅ 완료')
  }

  // 완료 요약
  console.log('\n' + '='.repeat(50))
  console.log('📊 마이그레이션 결과')
  console.log('='.repeat(50))
  console.log(`  포스트: ${postSuccessCount}/${sanityData.posts.length}개`)
  console.log(`  댓글:   ${commentSuccessCount}/${sanityData.comments.length}개`)
  console.log(`  이미지: ${urlMap.size}개 매핑`)
  console.log(`  모드:   ${DRY_RUN ? 'DRY RUN' : '실제 실행'}`)
  console.log('='.repeat(50))
}

main().catch((err) => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
