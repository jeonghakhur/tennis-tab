/**
 * profiles 테이블 민감 필드 암호화 마이그레이션
 *
 * 실행:
 *   npx tsx scripts/migrate-encrypt-profiles.ts
 *
 * DRY RUN (실제 DB 수정 없이 대상 확인):
 *   DRY_RUN=true npx tsx scripts/migrate-encrypt-profiles.ts
 *
 * 동작:
 *   1. profiles 전체 조회 (100건씩 페이지네이션)
 *   2. isEncrypted()=false인 phone/birth_year/gender만 선별
 *   3. 10건씩 병렬 업데이트
 *   4. 에러 발생 시 해당 row만 skip (전체 중단 없음)
 *   5. 완료 후 통계 출력
 */

import { createClient } from '@supabase/supabase-js'
import { encrypt, isEncrypted } from '../src/lib/crypto/encryption'

// 실행 방법:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ENCRYPTION_KEY=... \
//   npx tsx scripts/migrate-encrypt-profiles.ts

// gender는 DB CHECK 제약('M'/'F') 충돌 + 2값뿐이라 암호화 실익 없어 제외
const FIELDS = ['phone', 'birth_year'] as const
type Field = (typeof FIELDS)[number]

const PAGE_SIZE = 100
const BATCH_SIZE = 10

interface MigrationStats {
  total: number
  needsEncryption: number
  encrypted: number
  skipped: number
  errors: number
}

async function main() {
  const isDryRun = process.env.DRY_RUN === 'true'

  if (isDryRun) {
    console.log('[DRY RUN] 실제 DB 수정 없이 대상만 확인합니다.\n')
  }

  // 환경변수 검증
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
    process.exit(1)
  }

  // ENCRYPTION_KEY는 encrypt() 내부에서 검증됨
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const stats: MigrationStats = {
    total: 0,
    needsEncryption: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  }

  console.log('profiles 테이블 암호화 마이그레이션 시작...\n')

  let from = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('id, phone, birth_year, gender')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('profiles 조회 실패:', error.message)
      process.exit(1)
    }

    if (!rows || rows.length === 0) break

    stats.total += rows.length

    // 암호화가 필요한 row 필터링
    const targets = rows.filter((row) =>
      FIELDS.some((field) => {
        const val = row[field]
        return typeof val === 'string' && val && !isEncrypted(val)
      }),
    )

    stats.needsEncryption += targets.length

    if (targets.length === 0) {
      console.log(`  ${from + 1}~${from + rows.length}: 모두 이미 암호화됨 (skip)`)
      from += PAGE_SIZE
      continue
    }

    console.log(
      `  ${from + 1}~${from + rows.length}: ${targets.length}건 암호화 대상 발견`,
    )

    if (!isDryRun) {
      // BATCH_SIZE씩 병렬 처리
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (row) => {
            try {
              const updates: Partial<Record<Field, string>> = {}
              for (const field of FIELDS) {
                const val = row[field]
                if (typeof val === 'string' && val && !isEncrypted(val)) {
                  updates[field] = encrypt(val)
                }
              }

              const { error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', row.id)

              if (updateError) {
                console.error(`  [ERROR] id=${row.id}:`, updateError.message)
                stats.errors++
              } else {
                stats.encrypted++
              }
            } catch (err) {
              console.error(`  [ERROR] id=${row.id}:`, err)
              stats.errors++
            }
          }),
        )
      }
    } else {
      stats.skipped += targets.length
      targets.forEach((row) => {
        const fields = FIELDS.filter((f) => {
          const val = row[f]
          return typeof val === 'string' && val && !isEncrypted(val)
        })
        console.log(`    [DRY] id=${row.id} 암호화 대상 필드: ${fields.join(', ')}`)
      })
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  console.log('\n=== 마이그레이션 완료 ===')
  console.log(`총 처리: ${stats.total}건`)
  console.log(`암호화 필요: ${stats.needsEncryption}건`)

  if (isDryRun) {
    console.log(`[DRY RUN] 암호화 예정: ${stats.skipped}건 (실제 수정 없음)`)
  } else {
    console.log(`암호화 성공: ${stats.encrypted}건`)
    console.log(`에러: ${stats.errors}건`)
  }
}

main().catch((err) => {
  console.error('마이그레이션 중 예상치 못한 오류:', err)
  process.exit(1)
})
