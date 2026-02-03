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
  console.log('🚀 마이그레이션 시작...\n');

  try {
    // 1. dominant_hand 컬럼 삭제
    console.log('1️⃣ dominant_hand 컬럼 삭제 중...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.profiles DROP COLUMN IF EXISTS dominant_hand;'
    });
    
    if (dropError) {
      console.log('⚠️ dominant_hand 컬럼 삭제 실패 (이미 삭제되었을 수 있음):', dropError.message);
    } else {
      console.log('✅ dominant_hand 컬럼 삭제 완료\n');
    }

    // 2. club_city 컬럼 추가
    console.log('2️⃣ club_city 컬럼 추가 중...');
    const { error: cityError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_city TEXT;'
    });
    
    if (cityError) {
      console.log('⚠️ club_city 컬럼 추가 실패:', cityError.message);
    } else {
      console.log('✅ club_city 컬럼 추가 완료\n');
    }

    // 3. club_district 컬럼 추가
    console.log('3️⃣ club_district 컬럼 추가 중...');
    const { error: districtError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_district TEXT;'
    });
    
    if (districtError) {
      console.log('⚠️ club_district 컬럼 추가 실패:', districtError.message);
    } else {
      console.log('✅ club_district 컬럼 추가 완료\n');
    }

    // 4. 테이블 스키마 확인
    console.log('4️⃣ 프로필 테이블 스키마 확인 중...');
    const { data: profiles, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (selectError) {
      console.error('❌ 스키마 확인 실패:', selectError.message);
    } else {
      console.log('✅ 마이그레이션 완료!\n');
      console.log('📊 프로필 테이블 컬럼 목록:');
      if (profiles && profiles.length > 0) {
        console.log(Object.keys(profiles[0]).join(', '));
      }
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
