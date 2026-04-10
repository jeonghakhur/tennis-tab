#!/usr/bin/env node
/**
 * profiles.phone 평문 재암호화 스크립트
 *
 * 목적:
 *   네이버 콜백 encryptProfile() 누락 버그로 평문 저장된 profiles.phone/birth_year를
 *   찾아서 암호화된 값으로 UPDATE한다.
 *
 * 실행:
 *   node --env-file=.env.local scripts/reencrypt-profile-phones.mjs --dry-run
 *   node --env-file=.env.local scripts/reencrypt-profile-phones.mjs
 *
 * 관련 문서:
 *   - Design: docs/02-design/features/phone-normalization-cleanup.design.md §6.4
 *   - Audit: docs/03-analysis/phone-audit.md §3.1
 *
 * 원칙:
 *   - --dry-run 플래그로 먼저 미리보기 (UPDATE 없이 대상 리스트만 출력)
 *   - `src/lib/crypto/encryption.ts`의 encrypt() 로직을 그대로 복제 (의존성 없이 독립 실행)
 *   - 암호화 key: process.env.ENCRYPTION_KEY (32 bytes hex = 64자)
 *   - DB key: process.env.SUPABASE_SERVICE_ROLE_KEY
 *   - 행 단위 개별 UPDATE → 한 건 실패해도 나머지는 진행
 *   - 실행 전후 통계 출력
 */

import { createCipheriv, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ─── 설정 ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY

const isDryRun = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수 누락')
  console.error('   실행: node --env-file=.env.local scripts/reencrypt-profile-phones.mjs [--dry-run]')
  process.exit(1)
}

if (!ENCRYPTION_KEY_HEX) {
  console.error('❌ ENCRYPTION_KEY 환경변수 누락')
  process.exit(1)
}

if (ENCRYPTION_KEY_HEX.length !== 64) {
  console.error(`❌ ENCRYPTION_KEY는 32바이트 hex (64자) 필요. 현재: ${ENCRYPTION_KEY_HEX.length}자`)
  process.exit(1)
}

// ─── encryption.ts 로직 복제 ──────────────────────────────────────────────
const CIPHER_ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i

function isEncrypted(value) {
  if (!value) return false
  return ENCRYPTED_PATTERN.test(value)
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext

  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// ─── phone 정규화 (phone.ts 복제) ─────────────────────────────────────────
function unformatPhoneNumber(value) {
  if (!value) return ''
  return String(value).replace(/\D/g, '')
}

// ─── 마스킹 (로그 보호) ────────────────────────────────────────────────────
function maskPhone(phone) {
  if (!phone) return ''
  const digits = unformatPhoneNumber(phone)
  if (digits.length < 4) return '***'
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

function maskEmail(email) {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const maskedLocal = local.length <= 2 ? '**' : `${local.slice(0, 2)}***`
  return `${maskedLocal}@${domain}`
}

// ─── 메인 로직 ────────────────────────────────────────────────────────────
async function main() {
  console.log('━'.repeat(70))
  console.log(`🔐 profiles.phone/birth_year 재암호화 스크립트`)
  console.log(`   모드: ${isDryRun ? '🔍 DRY-RUN (읽기만)' : '⚠️  실제 실행 (UPDATE)'}`)
  console.log(`   DB: ${SUPABASE_URL}`)
  console.log('━'.repeat(70))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. 평문 대상 조회 (phone 또는 birth_year 중 하나라도 평문이면 대상)
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, email, name, phone, birth_year, created_at')
    .or('phone.not.is.null,birth_year.not.is.null')

  if (error) {
    console.error('❌ profiles 조회 실패:', error.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('ℹ️  profiles 행 없음')
    return
  }

  // 2. 평문 필드가 있는 행만 필터
  const targets = rows.filter((r) => {
    const phonePlain = r.phone && !isEncrypted(r.phone)
    const birthPlain = r.birth_year && !isEncrypted(r.birth_year)
    return phonePlain || birthPlain
  })

  console.log(`\n📊 조회 결과: 전체 ${rows.length}건 중 평문 필드 보유 ${targets.length}건`)

  if (targets.length === 0) {
    console.log('✅ 재암호화 대상 없음. 모든 profiles.phone/birth_year가 이미 암호화됨.')
    return
  }

  // 3. 대상 목록 출력
  console.log('\n🎯 재암호화 대상:')
  console.log('─'.repeat(70))
  for (const r of targets) {
    const phoneState = !r.phone
      ? '(없음)'
      : isEncrypted(r.phone)
        ? '암호화'
        : `❌ 평문 ${maskPhone(r.phone)}`
    const birthState = !r.birth_year
      ? '(없음)'
      : isEncrypted(r.birth_year)
        ? '암호화'
        : `❌ 평문 ${r.birth_year}`
    console.log(`  ${r.id.slice(0, 8)}... | ${maskEmail(r.email)} | ${r.name || '(이름없음)'}`)
    console.log(`     phone:      ${phoneState}`)
    console.log(`     birth_year: ${birthState}`)
    console.log(`     created:    ${r.created_at}`)
  }
  console.log('─'.repeat(70))

  // 4. DRY-RUN이면 종료
  if (isDryRun) {
    console.log(`\n✋ DRY-RUN 모드 종료. 실제 UPDATE 하려면 --dry-run 플래그 제거 후 재실행.`)
    console.log(`   node --env-file=.env.local scripts/reencrypt-profile-phones.mjs`)
    return
  }

  // 5. 실제 UPDATE 실행
  console.log(`\n🔧 ${targets.length}건 재암호화 시작...`)
  let success = 0
  let failed = 0
  const failures = []

  for (const r of targets) {
    try {
      const updateData = { updated_at: new Date().toISOString() }

      // phone 평문이면 정규화 후 암호화
      if (r.phone && !isEncrypted(r.phone)) {
        const normalized = unformatPhoneNumber(r.phone)
        if (!normalized) {
          console.log(`  ⏭  ${r.id.slice(0, 8)}... phone 정규화 결과 empty, 스킵`)
          continue
        }
        updateData.phone = encrypt(normalized)
      }

      // birth_year 평문이면 암호화 (공백만 trim)
      if (r.birth_year && !isEncrypted(r.birth_year)) {
        updateData.birth_year = encrypt(String(r.birth_year).trim())
      }

      // 업데이트할 게 없으면 스킵
      if (!updateData.phone && !updateData.birth_year) {
        continue
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', r.id)

      if (updateError) {
        console.error(`  ❌ ${r.id.slice(0, 8)}... UPDATE 실패: ${updateError.message}`)
        failed++
        failures.push({ id: r.id, error: updateError.message })
      } else {
        console.log(`  ✅ ${r.id.slice(0, 8)}... | ${r.name || maskEmail(r.email)}`)
        success++
      }
    } catch (e) {
      console.error(`  ❌ ${r.id.slice(0, 8)}... 예외 발생:`, e)
      failed++
      failures.push({ id: r.id, error: String(e) })
    }
  }

  console.log('\n━'.repeat(35))
  console.log(`📊 결과: 성공 ${success}건 / 실패 ${failed}건`)
  console.log('━'.repeat(35))

  if (failures.length > 0) {
    console.log('\n❌ 실패 목록:')
    for (const f of failures) console.log(`  - ${f.id}: ${f.error}`)
    process.exit(1)
  }

  // 6. 실행 후 검증
  console.log('\n🔍 재실행 검증 (평문 남은 건수 확인)...')
  const { data: verify } = await supabase
    .from('profiles')
    .select('id, phone, birth_year')
    .or('phone.not.is.null,birth_year.not.is.null')

  const remaining =
    verify?.filter((r) => {
      const p = r.phone && !isEncrypted(r.phone)
      const b = r.birth_year && !isEncrypted(r.birth_year)
      return p || b
    }).length ?? 0

  if (remaining === 0) {
    console.log(`✅ 평문 0건. 재암호화 완료!`)
  } else {
    console.log(`⚠️  평문 ${remaining}건 남음. 수동 확인 필요.`)
  }
}

main().catch((e) => {
  console.error('❌ 치명적 에러:', e)
  process.exit(1)
})
