/**
 * 코치 계정 생성 스크립트
 * 실행: node --env-file=.env.local scripts/seed-coaches.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'

// ── 암호화 (profileCrypto와 동일 로직) ────────────────────────────────────
function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY 누락 또는 형식 오류')
  const key = Buffer.from(hex, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// ── Supabase Admin Client ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── 생성할 코치 목록 ──────────────────────────────────────────────────────
const COACHES = [
  { name: '강한',  email: 'ganghan@mapo-tennis.com',   phone: '01085891858' },
  { name: '김동하', email: 'kimdongha@mapo-tennis.com', phone: '01085891858' },
]
const PASSWORD = 'test1234!@'

async function createCoach({ name, email, phone }) {
  console.log(`\n▶ ${name} (${email}) 생성 중...`)

  // 1. auth.users 생성 (이메일 인증 skip)
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authErr) {
    // 이미 존재하는 경우 기존 유저 조회
    if (authErr.message.includes('already')) {
      console.log('  ⚠️  이미 존재하는 이메일, 기존 유저로 계속 진행')
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const existing = users.find(u => u.email === email)
      if (!existing) { console.error('  ❌ 유저 조회 실패'); return }
      return await updateProfile(existing.id, name, phone)
    }
    console.error('  ❌ auth 생성 실패:', authErr.message)
    return
  }

  const userId = authData.user.id
  console.log('  ✅ auth 유저 생성:', userId)

  await updateProfile(userId, name, phone)
}

async function updateProfile(userId, name, phone) {
  // 2. profiles 테이블 phone 업데이트 (handle_new_user 트리거가 기본값 삽입)
  const encryptedPhone = encrypt(phone)
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ phone: encryptedPhone })
    .eq('id', userId)

  if (profileErr) {
    console.error('  ❌ profile 업데이트 실패:', profileErr.message)
    return
  }
  console.log('  ✅ profile phone 업데이트 완료')

  // 3. coaches 테이블에 등록
  const { data: existing } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    console.log('  ⚠️  coaches 이미 존재, 건너뜀')
    return
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single()

  const { error: coachErr } = await supabase
    .from('coaches')
    .insert({
      name: profileData?.name ?? name,
      is_active: true,
      user_id: userId,
      created_by: userId,
    })

  if (coachErr) {
    console.error('  ❌ coach 등록 실패:', coachErr.message)
    return
  }
  console.log('  ✅ coaches 등록 완료')
}

// ── 실행 ──────────────────────────────────────────────────────────────────
console.log('🎾 코치 계정 생성 시작\n')
for (const coach of COACHES) {
  await createCoach(coach)
}
console.log('\n✅ 완료')
