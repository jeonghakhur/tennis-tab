import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 복식 마이그레이션 실행 체크 + SQL 반환
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // match_type 컬럼 존재 여부를 에러로 판단
  const { error } = await admin
    .from('club_match_results')
    .select('match_type')
    .limit(1)

  if (!error) {
    return NextResponse.json({ status: 'already_migrated', message: '이미 마이그레이션 완료됨' })
  }

  return NextResponse.json({
    status: 'migration_needed',
    message: 'Supabase Dashboard SQL Editor에서 다음 SQL을 실행해주세요:',
    sql: `ALTER TABLE club_match_results
  ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'singles' CHECK (match_type IN ('singles', 'doubles_men', 'doubles_women', 'doubles_mixed')),
  ADD COLUMN IF NOT EXISTS player1b_member_id UUID REFERENCES club_members(id),
  ADD COLUMN IF NOT EXISTS player2b_member_id UUID REFERENCES club_members(id);`
  })
}
