/**
 * Waitlist 마이그레이션 적용 스크립트
 * supabase/migrations/20260204_add_waitlist.sql 파일을 읽어 실행합니다.
 * 
 * 실행 방법:
 * npx tsx scripts/apply-waitlist-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 기존 스크립트의 설정을 참고 (실제 운영 환경에서는 환경변수 사용 권장)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tigqwrehpzwaksnvcrrx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase URL 또는 Service Role Key가 설정되지 않았습니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('🚀 Waitlist 마이그레이션 적용 시작...\n');

    try {
        // SQL 파일 읽기
        const migrationFilePath = path.join(process.cwd(), 'supabase/migrations/20260204_add_waitlist.sql');

        if (!fs.existsSync(migrationFilePath)) {
            throw new Error(`마이그레이션 파일을 찾을 수 없습니다: ${migrationFilePath}`);
        }

        const sql = fs.readFileSync(migrationFilePath, 'utf8');
        console.log(`📄 파일 읽기 성공: ${path.basename(migrationFilePath)}`);

        console.log('1️⃣ SQL 실행 중...');

        // exec_sql RPC 호출 (기존 run-migration.ts 참조)
        const { error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            console.log('❌ 마이그레이션 실패:', error.message);
            console.log('힌트: `exec_sql` 함수가 Supabase에 없다면 Dashboard SQL Editor에서 직접 파일을 복사/붙여넣기 실행해주세요.');
        } else {
            console.log('✅ 마이그레이션이 성공적으로 적용되었습니다!');
        }

    } catch (error: any) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

applyMigration()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ 스크립트 실행 실패:', error);
        process.exit(1);
    });
