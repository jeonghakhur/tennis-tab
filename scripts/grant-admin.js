const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.local 파일 파싱 함수
function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                if (key && value && !key.startsWith('#')) {
                    env[key] = value;
                }
            }
        });
        return env;
    } catch (error) {
        console.error('Error loading .env.local:', error);
        process.exit(1);
    }
}

async function grantAdmin() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: node scripts/grant-admin.js <email>');
        process.exit(1);
    }

    const env = loadEnv();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing Supabase credentials in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`Searching for user with email: ${email}...`);

    // 1. users 테이블에서 user_id 찾기 (admin api 사용 필요할 수도 있지만, profiles가 이메일을 가지고 있으므로 profiles로 바로 접근 시도)

    // profiles 테이블 업데이트 (RLS 우회 - service role key 사용시 자동 우회됨)
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'ADMIN' })
        .eq('email', email)
        .select();

    if (error) {
        console.error('Error updating profile:', error);
        process.exit(1);
    }

    if (data && data.length > 0) {
        console.log(`SUCCESS: User ${email} promoted to ADMIN.`);
        console.log('User profile:', data[0]);
    } else {
        console.log(`User with email ${email} not found in profiles table.`);
        console.log('Please make sure the user has logged in at least once.');
    }
}

grantAdmin();
