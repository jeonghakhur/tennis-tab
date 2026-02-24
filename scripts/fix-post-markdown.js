/**
 * 마이그레이션 포스트 마크다운 → HTML 재변환 스크립트
 *
 * 사용법:
 *   node scripts/fix-post-markdown.js              # 실행
 *   node scripts/fix-post-markdown.js --dry-run    # 확인만
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')

// ── .env.local 로드 ──
function loadEnv() {
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
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 이미지 URL 매핑 로드 (원본 Sanity content → 현재 DB content에서 추출) ──
function extractImageMap(originalContent, dbContent) {
  const map = new Map()
  // 원본 마크다운 이미지
  const mdRegex = /!\[([^\]]*)\]\((https:\/\/cdn\.sanity\.io\/[^)]+)\)/g
  const sanityUrls = []
  let match
  while ((match = mdRegex.exec(originalContent)) !== null) {
    sanityUrls.push(match[2])
  }

  // DB HTML 이미지
  const htmlRegex = /<img[^>]+src="([^"]+)"[^>]*>/g
  const dbUrls = []
  while ((match = htmlRegex.exec(dbContent)) !== null) {
    dbUrls.push(match[1])
  }

  // 순서대로 매핑
  for (let i = 0; i < Math.min(sanityUrls.length, dbUrls.length); i++) {
    map.set(sanityUrls[i], dbUrls[i])
  }

  return map
}

// ── 마크다운 → HTML 변환 (완전판) ──
function markdownToHtml(content, imageUrlMap) {
  if (!content) return ''

  // 1. 이미지 마크다운 → <img> 태그 (URL 교체)
  const IMG_REGEX = /!\[([^\]]*)\]\((https:\/\/cdn\.sanity\.io\/[^)]+)\)/g
  let processed = content.replace(IMG_REGEX, (_, alt, url) => {
    const newUrl = imageUrlMap.get(url) || url
    return `<img src="${newUrl}" alt="${escapeHtml(alt)}">`
  })

  // 2. escaped characters 복원
  processed = processed.replace(/\\([.~*#\[\](){}+\-!])/g, '$1')

  // 3. 줄 단위 파싱
  const lines = processed.split('\n')
  const htmlParts = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // 빈 줄 무시
    if (line === '') {
      i++
      continue
    }

    // 수평선 (*** 또는 ---)
    if (/^\*{3,}$/.test(line) || /^-{3,}$/.test(line)) {
      htmlParts.push('<hr>')
      i++
      continue
    }

    // 제목 (#, ##, ###, ####, #####)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = inlineFormat(headingMatch[2])
      htmlParts.push(`<h${level}>${text}</h${level}>`)
      i++
      continue
    }

    // 순서 없는 목록 (* item 또는 - item)
    if (/^\*\s+/.test(line) || /^-\s+(?!-)/.test(line)) {
      const listItems = []
      while (i < lines.length) {
        const l = lines[i].trim()
        const itemMatch = l.match(/^[*-]\s+(.+)$/)
        if (itemMatch) {
          listItems.push(`<li>${inlineFormat(itemMatch[1])}</li>`)
          i++
        } else {
          break
        }
      }
      htmlParts.push(`<ul>${listItems.join('')}</ul>`)
      continue
    }

    // 순서 있는 목록 (1. item)
    if (/^\d+\.\s+/.test(line)) {
      const listItems = []
      while (i < lines.length) {
        const l = lines[i].trim()
        const itemMatch = l.match(/^\d+\.\s+(.+)$/)
        if (itemMatch) {
          listItems.push(`<li>${inlineFormat(itemMatch[1])}</li>`)
          i++
        } else {
          break
        }
      }
      htmlParts.push(`<ol>${listItems.join('')}</ol>`)
      continue
    }

    // img 태그만 있는 줄
    if (/^(<img [^>]+>)+$/.test(line)) {
      htmlParts.push(line)
      i++
      continue
    }

    // 일반 텍스트 → 단락 (연속 줄 합치기)
    const paragraphLines = []
    while (i < lines.length) {
      const l = lines[i].trim()
      if (l === '' || /^\*{3,}$/.test(l) || /^-{3,}$/.test(l) || /^#{1,6}\s/.test(l) || /^[*-]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
        break
      }
      paragraphLines.push(l)
      i++
    }
    const paraContent = inlineFormat(paragraphLines.join('<br>'))
    htmlParts.push(`<p>${paraContent}</p>`)
  }

  return htmlParts.join('')
}

// ── 인라인 포맷 (bold, span 보존) ──
function inlineFormat(text) {
  // **bold** → <strong>
  let result = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // *italic* → <em> (단, * 리스트와 구분 — 줄 시작이 아닌 경우만)
  // 여기서는 리스트 처리 후이므로 안전
  // result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')

  // 깨진 span 태그 복구 (<span> → </span>)
  result = result.replace(/<span>/g, '</span>')

  return result
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
  console.log(`\n🔧 포스트 마크다운 → HTML 재변환`)
  console.log(`   모드: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 실제 실행'}\n`)

  // 원본 Sanity 데이터 로드
  const dataPath = path.join(__dirname, 'sanity-posts-data.json')
  const sanityData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

  // 작성자의 모든 DB 포스트 조회
  const { data: dbPosts } = await supabase
    .from('posts')
    .select('id, title, content, created_at')
    .eq('author_id', '2462b67a-3f98-4dd6-b51d-e1c9ff61d00d')
    .order('created_at')

  if (!dbPosts || dbPosts.length === 0) {
    console.log('마이그레이션 포스트를 찾을 수 없습니다.')
    return
  }

  // Sanity title → DB post 매핑
  const dbByTitle = new Map(dbPosts.map((p) => [p.title, p]))

  let updateCount = 0
  let skipCount = 0

  for (const sanityPost of sanityData.posts) {
    const dbPost = dbByTitle.get(sanityPost.title)
    if (!dbPost) {
      console.log(`  ⚠️ DB에서 찾을 수 없음: ${sanityPost.title.slice(0, 40)}`)
      continue
    }

    // 이미지 URL 매핑 추출
    const imageMap = extractImageMap(sanityPost.content || '', dbPost.content || '')

    // 원본 마크다운에서 제대로 HTML 변환
    const newHtml = markdownToHtml(sanityPost.content || '', imageMap)

    // 변환 결과가 기존과 같으면 스킵
    if (newHtml === dbPost.content) {
      skipCount++
      continue
    }

    if (DRY_RUN) {
      console.log(`  📝 [DRY] ${sanityPost.title.slice(0, 50)}`)
      console.log(`     기존: ${dbPost.content.slice(0, 80)}...`)
      console.log(`     변환: ${newHtml.slice(0, 80)}...`)
      updateCount++
      continue
    }

    const { error } = await supabase
      .from('posts')
      .update({ content: newHtml })
      .eq('id', dbPost.id)

    if (error) {
      console.log(`  ❌ 업데이트 실패: ${sanityPost.title.slice(0, 40)} → ${error.message}`)
    } else {
      console.log(`  ✅ ${sanityPost.title.slice(0, 50)}`)
      updateCount++
    }
  }

  console.log(`\n완료: ${updateCount}개 업데이트, ${skipCount}개 스킵`)
}

main().catch((err) => {
  console.error('오류:', err)
  process.exit(1)
})
