const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.local 로드
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

async function testCreateTournament() {
    const env = loadEnv();
    // Service Role Key 사용 (RLS 우회)
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('🧪 Testing Tournament Creation (Backend Direct)...');

    // 1. 주최자(Organizer) 찾기 - 첫 번째 ADMIN 또는 SUPER_ADMIN 찾기
    let { data: organizer } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['ADMIN', 'SUPER_ADMIN', 'MANAGER'])
        .limit(1)
        .single();

    // 만약 관리자가 없다면, 아무 유저나 한 명 찾아서 테스트용으로 사용 (실제 앱에서는 안됨)
    if (!organizer) {
        console.log('No Admin/Manager found. Trying to find any user for testing...');
        const { data: anyUser } = await supabase.from('profiles').select('id').limit(1).single();
        organizer = anyUser;
    }

    if (!organizer) {
        console.error('❌ Error: No users found in database to set as organizer.');
        console.error('Please login via UI first to create a user profile.');
        process.exit(1);
    }

    const testTournament = {
        title: '🤖 AI Automated Test Tournament',
        description: 'This tournament was created by the AI test script to verify DB schema.',
        start_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_date: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        location: 'Virtual Test Court',
        max_participants: 8,
        entry_fee: 0,
        format: 'SINGLE_ELIMINATION',
        status: 'OPEN',
        organizer_id: organizer.id
    };

    const { data, error } = await supabase
        .from('tournaments')
        .insert(testTournament)
        .select()
        .single();

    if (error) {
        console.error('❌ Failed to create tournament:', error);
        process.exit(1);
    }

    console.log('✅ Successfully created tournament!');
    console.log('ID:', data.id);
    console.log('Title:', data.title);
    console.log('Organizer ID:', data.organizer_id);
}

testCreateTournament();
