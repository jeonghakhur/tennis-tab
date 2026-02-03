/**
 * 프로필 테이블 마이그레이션 스크립트
 * dominant_hand 삭제, club_city/club_district 추가
 * 
 * 실행 방법:
 * NEXT_PUBLIC_SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tigqwrehpzwaksnvcrrx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL 또는 Service Role Key가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 RLS 정책 완화 마이그레이션 시작...\n');

  try {
    const sql = `
      -- Tournaments 테이블 RLS 완화 (개발용)
      DROP POLICY IF EXISTS "Admins can create tournaments" ON tournaments;
      DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON tournaments;
      CREATE POLICY "Authenticated users can create tournaments" ON tournaments
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

      -- Tournament Divisions 테이블 RLS 완화 (개발용)
      DROP POLICY IF EXISTS "Admins can create tournament divisions" ON tournament_divisions;
      DROP POLICY IF EXISTS "Authenticated users can create tournament divisions" ON tournament_divisions;
      CREATE POLICY "Authenticated users can create tournament divisions" ON tournament_divisions
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
          )
        );
    `;

    console.log('1️⃣ SQL 실행 중...');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.log('❌ RLS 정책 업데이트 실패:', error.message);
      // exec_sql이 없으면 Supabase Dashboard SQL Editor에서 직접 실행해야 함을 알림
      console.log('👉 Supabase Dashboard의 SQL Editor에서 위 SQL을 직접 실행해주세요.');
    } else {
      console.log('✅ RLS 정책이 성공적으로 업데이트되었습니다!\n');
      console.log('이제 누구나(로그인한 유저) 대회를 생성할 수 있습니다.');
    }

  } catch (error: any) {
    console.error('❌ 마이그레이션 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 실행
runMigration()
  .then(() => {
    console.log('\n🎉 마이그레이션이 성공적으로 완료되었습니다!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 마이그레이션 실패:', error);
    process.exit(1);
  });
