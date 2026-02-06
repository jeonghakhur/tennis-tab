/**
 * tournaments 테이블의 실제 컬럼 구성을 확인하는 스크립트
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tigqwrehpzwaksnvcrrx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('🔍 tournaments 테이블 스키마 확인 중...\n');

    try {
        // 임의의 데이터를 하나 가져와서 구조 확인
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('❌ 데이터 조회 실패:', error.message);
            return;
        }

        if (data) {
            console.log('✅ 현재 테이블 컬럼 목록:');
            console.log(Object.keys(data).join(', '));

            const hasColumn = 'team_match_count' in data;
            console.log(`\n👉 team_match_count 컬럼 존재 여부: ${hasColumn ? '있음 ✅' : '없음 ❌'}`);

            if (!hasColumn) {
                console.log('\n⚠️ 컬럼이 없어서 수정 시 오류가 발생하고 있습니다.');
            }
        } else {
            console.log('ℹ️ 조회된 데이터가 없습니다.');
        }

    } catch (error: any) {
        console.error('❌ 실행 중 오류 발생:', error.message);
    }
}

checkSchema().then(() => process.exit(0));
