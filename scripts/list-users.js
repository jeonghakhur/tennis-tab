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

async function listUsers() {
    const env = loadEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔍 Listing all users in profiles table...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching profiles:', error);
        process.exit(1);
    }

    if (profiles.length === 0) {
        console.log('No users found in profiles table.');
    } else {
        console.table(profiles.map(p => ({
            Email: p.email,
            Name: p.name,
            Role: p.role,
            ID: p.id
        })));
    }
}

listUsers();
