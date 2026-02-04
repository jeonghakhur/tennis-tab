/**
 * tournament_entries 더미 데이터 100건 삽입
 * 대상 대회: b35e793d-de18-4b46-a5b3-a80bfcabb702
 *
 * 사용법: node scripts/seed-tournament-entries.js
 *
 * 제약: UNIQUE(tournament_id, user_id, division_id) → 동일 대회·동일 유저·동일 부서는 1건만 가능.
 *      profiles가 부족하면 Admin API로 테스트 사용자(및 프로필)를 자동 생성한 뒤 100건 삽입.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TOURNAMENT_ID = 'b35e793d-de18-4b46-a5b3-a80bfcabb702';
const TARGET_COUNT = 100;
const SEED_PASSWORD = 'seed-password-123!';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && value) env[key] = value;
    }
  });
  return env;
}

function dummyEntry(index, userId, divisionId) {
  const n = index + 1;
  const statuses = ['PENDING', 'APPROVED', 'PENDING', 'PENDING', 'APPROVED'];
  const paymentStatuses = ['PENDING', 'COMPLETED', 'PENDING', 'COMPLETED', 'PENDING'];
  const row = {
    tournament_id: TOURNAMENT_ID,
    user_id: userId,
    division_id: divisionId,
    status: statuses[n % statuses.length],
    phone: `010-${String(1000 + (n % 9000)).slice(1)}-${String(1000 + (n % 9000)).slice(1)}`,
    player_name: `참가자${n}`,
    player_rating: 50 + (n % 31),
    club_name: n % 3 === 0 ? `테니스클럽${(n % 5) + 1}` : null,
    team_order: null,
    partner_data: null,
    team_members: null,
    payment_status: paymentStatuses[n % paymentStatuses.length],
  };
  return row;
}

async function ensureEnoughProfiles(supabase, neededCount) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(neededCount + 10);

  const current = profiles?.length ?? 0;
  if (current >= neededCount) return;

  const toCreate = neededCount - current;
  console.log(`profiles 부족: ${current}명. 테스트 사용자 ${toCreate}명 생성 중...`);

  for (let i = 0; i < toCreate; i++) {
    const email = `seed-entry-${Date.now()}-${i}@tennis-tab.local`;
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: `참가자시드${i + 1}` },
    });
    if (error) {
      console.error(`사용자 생성 실패 (${i + 1}/${toCreate}):`, error.message);
      continue;
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${toCreate} 생성됨`);
  }

  console.log('테스트 사용자 생성 완료. profiles 반영 대기 2초...');
  await new Promise((r) => setTimeout(r, 2000));
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('대회 ID:', TOURNAMENT_ID);
  console.log('목표 참가 신청 수:', TARGET_COUNT);

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, title')
    .eq('id', TOURNAMENT_ID)
    .single();

  if (tErr || !tournament) {
    console.error('대회를 찾을 수 없습니다:', tErr?.message || 'No data');
    process.exit(1);
  }
  console.log('대회:', tournament.title);

  const { data: divisions, error: dErr } = await supabase
    .from('tournament_divisions')
    .select('id, name')
    .eq('tournament_id', TOURNAMENT_ID)
    .order('created_at', { ascending: true });

  if (dErr || !divisions?.length) {
    console.error('해당 대회의 참가 부서가 없습니다. 먼저 부서를 추가해 주세요.', dErr?.message);
    process.exit(1);
  }
  console.log('참가 부서 수:', divisions.length, divisions.map((d) => d.name).join(', '));

  await ensureEnoughProfiles(supabase, TARGET_COUNT);

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(TARGET_COUNT + 10);

  if (pErr || !profiles?.length) {
    console.error('profiles 조회 실패:', pErr?.message);
    process.exit(1);
  }
  console.log('사용 가능한 profiles 수:', profiles.length);

  const divisionId = divisions[0].id;
  const count = Math.min(TARGET_COUNT, profiles.length);

  const { error: delErr } = await supabase
    .from('tournament_entries')
    .delete()
    .eq('tournament_id', TOURNAMENT_ID);

  if (delErr) {
    console.error('기존 참가 신청 삭제 실패:', delErr.message);
    process.exit(1);
  }
  console.log('기존 참가 신청 삭제 완료. 새로', count, '건 삽입 중...');

  const toInsert = profiles.slice(0, count).map((prof, i) => dummyEntry(i, prof.id, divisionId));

  const { data: inserted, error: insertErr } = await supabase
    .from('tournament_entries')
    .insert(toInsert)
    .select('id');

  if (insertErr) {
    console.error('삽입 실패:', insertErr.message);
    if (insertErr.code === '23505') {
      console.error('일부 (tournament_id, user_id) 조합이 이미 존재합니다.');
    }
    process.exit(1);
  }

  console.log('✅ tournament_entries 더미 데이터', inserted?.length ?? 0, '건 추가 완료.');
}

main();
