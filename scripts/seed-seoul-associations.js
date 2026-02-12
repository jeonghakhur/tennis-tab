/**
 * 서울시 25개 구 테니스협회 일괄 등록 스크립트
 *
 * 사용법:
 *   node scripts/seed-seoul-associations.js
 *
 * 옵션:
 *   --dry-run   실제 DB에 삽입하지 않고 데이터만 확인
 *   --delete    기존 서울시 협회 데이터를 모두 삭제 후 재등록
 *
 * 주의:
 *   - SUPER_ADMIN 또는 ADMIN 유저의 ID가 created_by에 필요
 *   - 스크립트 실행 전 .env.local에 Supabase 환경변수 필요
 *   - 동일 이름 협회가 이미 존재하면 해당 건은 스킵됨
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

// ── 서울시 25개 구 ──
const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
]

// ── 협회 데이터 생성 ──
function buildAssociations(createdBy) {
  return SEOUL_DISTRICTS.map((district) => ({
    name: `${district}테니스협회`,
    region: '서울특별시',
    district,
    description: `서울특별시 ${district} 테니스협회입니다.`,
    president_name: null,
    president_phone: null,
    president_email: null,
    secretary_name: null,
    secretary_phone: null,
    secretary_email: null,
    created_by: createdBy,
    is_active: true,
  }))
}

// ── 메인 ──
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isDelete = args.includes('--delete')

  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 1. created_by로 사용할 SUPER_ADMIN 유저 조회
  const { data: superAdmin, error: adminError } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('role', 'SUPER_ADMIN')
    .limit(1)
    .maybeSingle()

  if (adminError || !superAdmin) {
    // SUPER_ADMIN이 없으면 ADMIN이라도 사용
    const { data: admin } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle()

    if (!admin) {
      console.error('SUPER_ADMIN 또는 ADMIN 유저가 존재하지 않습니다.')
      console.error('먼저 node scripts/grant-admin.js <email> 로 관리자를 지정해주세요.')
      process.exit(1)
    }

    console.log(`⚠️  SUPER_ADMIN이 없어 ADMIN 유저를 사용합니다: ${admin.name} (${admin.email})`)
    var createdBy = admin.id
  } else {
    console.log(`✅ SUPER_ADMIN 유저: ${superAdmin.name} (${superAdmin.email})`)
    var createdBy = superAdmin.id
  }

  // 2. --delete 옵션: 기존 서울 협회 삭제
  if (isDelete) {
    console.log('\n🗑️  기존 서울시 협회 삭제 중...')
    const names = SEOUL_DISTRICTS.map((d) => `${d}테니스협회`)
    const { data: existing } = await supabase
      .from('associations')
      .select('id, name')
      .in('name', names)

    if (existing && existing.length > 0) {
      for (const assoc of existing) {
        // 소속 클럽 독립화
        await supabase
          .from('clubs')
          .update({ association_id: null, updated_at: new Date().toISOString() })
          .eq('association_id', assoc.id)

        // 매니저 강등
        const { data: managers } = await supabase
          .from('association_managers')
          .select('user_id')
          .eq('association_id', assoc.id)

        if (managers && managers.length > 0) {
          const managerIds = managers.map((m) => m.user_id)
          await supabase
            .from('profiles')
            .update({ role: 'USER', updated_at: new Date().toISOString() })
            .in('id', managerIds)
        }

        // 협회 삭제
        await supabase.from('associations').delete().eq('id', assoc.id)
        console.log(`  삭제: ${assoc.name}`)
      }
      console.log(`  총 ${existing.length}건 삭제 완료`)
    } else {
      console.log('  삭제할 서울시 협회가 없습니다.')
    }
  }

  // 3. 협회 데이터 생성
  const associations = buildAssociations(createdBy)

  if (isDryRun) {
    console.log('\n📋 [DRY RUN] 등록될 협회 목록:')
    console.table(
      associations.map((a) => ({
        이름: a.name,
        지역: a.region,
        구: a.district,
        설명: a.description,
      }))
    )
    console.log(`\n총 ${associations.length}개 협회 (실제 삽입 안 함)`)
    return
  }

  // 4. 기존 데이터 확인 (중복 스킵)
  const { data: existingAssocs } = await supabase
    .from('associations')
    .select('name')
    .eq('region', '서울특별시')

  const existingNames = new Set((existingAssocs || []).map((a) => a.name))

  const toInsert = associations.filter((a) => !existingNames.has(a.name))
  const skipped = associations.filter((a) => existingNames.has(a.name))

  if (skipped.length > 0) {
    console.log(`\n⏭️  이미 존재하여 스킵: ${skipped.map((a) => a.name).join(', ')}`)
  }

  if (toInsert.length === 0) {
    console.log('\n✅ 모든 서울시 협회가 이미 등록되어 있습니다.')
    return
  }

  // 5. 일괄 삽입
  console.log(`\n📝 ${toInsert.length}개 협회 등록 중...`)

  const { data: inserted, error: insertError } = await supabase
    .from('associations')
    .insert(toInsert)
    .select('id, name, district')

  if (insertError) {
    console.error('삽입 실패:', insertError.message)
    process.exit(1)
  }

  console.log('\n✅ 등록 완료:')
  console.table(
    inserted.map((a) => ({
      ID: a.id,
      이름: a.name,
      구: a.district,
    }))
  )
  console.log(`\n총 ${inserted.length}개 협회 등록 성공`)
}

main().catch((err) => {
  console.error('스크립트 실행 실패:', err)
  process.exit(1)
})
