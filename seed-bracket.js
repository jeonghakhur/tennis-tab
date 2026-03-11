const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://tigqwrehpzwaksnvcrrx.supabase.co', 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3')

const TID        = 'e608dacb-6b07-4e5b-8451-77ef71050ae3'
const MASTER_DIV = '80cfb874-648f-4139-acf5-675da21f6d95'
const CHALL_DIV  = '9747b444-d0d4-4b50-9448-946295f86565'

// 랜덤 셔플
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]]
  }
  return a
}

// 예선 조 편성 + 경기 생성
// groupSize: 조당 팀 수 (ex 4)
// groupCount: 총 조 수 (ex 4)
async function seedPrelim(divId, divName, groupCount, groupSize) {
  console.log(`\n🎾 ${divName} 예선 시딩 시작 (${groupCount}조 × ${groupSize}팀)`)

  // 기존 데이터 정리
  const {data: existingConfig} = await sb.from('bracket_configs').select('id').eq('division_id', divId).single()
  if (existingConfig) {
    const cid = existingConfig.id
    // group_teams → groups → bracket_matches → config 순서로 삭제
    const {data: groups} = await sb.from('preliminary_groups').select('id').eq('bracket_config_id', cid)
    if (groups?.length) {
      const gids = groups.map(g=>g.id)
      await sb.from('group_teams').delete().in('group_id', gids)
      await sb.from('bracket_matches').delete().in('group_id', gids)
      await sb.from('preliminary_groups').delete().eq('bracket_config_id', cid)
    }
    await sb.from('bracket_matches').delete().eq('bracket_config_id', cid)
    await sb.from('bracket_configs').delete().eq('id', cid)
    console.log('  🗑️ 기존 대진 삭제')
  }

  // entries 가져오기
  const {data: entries, error: ee} = await sb.from('tournament_entries')
    .select('id,player_name,club_name')
    .eq('division_id', divId)
    .eq('status', 'CONFIRMED')
  if (ee || !entries?.length) { console.error('entries 오류:', ee); return }
  console.log(`  📋 확정 팀: ${entries.length}팀`)

  const shuffled = shuffle(entries)

  // bracket_config 생성
  const {data: config, error: ce} = await sb.from('bracket_configs').insert({
    division_id: divId,
    has_preliminaries: true,
    third_place_match: true,
    bracket_size: groupCount * 2, // 각 조 1-2위 진출
    status: 'PRELIMINARY',
    group_size: Math.min(groupSize, 3),
    active_phase: 'PRELIMINARY',
    active_round: null,
  }).select().single()
  if (ce) { console.error('config 오류:', ce); return }
  console.log(`  ✅ bracket_config 생성: ${config.id}`)

  // 조 편성
  for (let g = 0; g < groupCount; g++) {
    const teamSlice = shuffled.slice(g * groupSize, (g+1) * groupSize)

    // preliminary_group 생성
    const {data: group, error: ge} = await sb.from('preliminary_groups').insert({
      bracket_config_id: config.id,
      name: String(g+1),
      display_order: g+1,
    }).select().single()
    if (ge) { console.error('group 오류:', ge); continue }

    // group_teams 등록
    const gtRows = teamSlice.map((e, idx) => ({
      group_id: group.id,
      entry_id: e.id,
      seed_number: idx+1,
      wins: 0, losses: 0, points_for: 0, points_against: 0,
    }))
    await sb.from('group_teams').insert(gtRows)

    // 리그 경기 생성 (조 내 모든 팀 대전)
    const matchRows = []
    let matchNum = 1
    for (let i = 0; i < teamSlice.length; i++) {
      for (let j = i+1; j < teamSlice.length; j++) {
        matchRows.push({
          bracket_config_id: config.id,
          phase: 'PRELIMINARY',
          group_id: group.id,
          match_number: matchNum++,
          team1_entry_id: teamSlice[i].id,
          team2_entry_id: teamSlice[j].id,
          status: 'SCHEDULED',
        })
      }
    }
    await sb.from('bracket_matches').insert(matchRows)

    const names = teamSlice.map(e => e.player_name).join(', ')
    console.log(`  📌 ${g+1}조 (${teamSlice.length}팀): ${names}`)
  }

  console.log(`  🎉 ${divName} 예선 완료! 총 ${groupCount}조`)
}

async function main() {
  // 마스터부: 16팀 → 4조 × 4팀
  await seedPrelim(MASTER_DIV, '마스터부', 4, 4)
  // 챌린저부: 32팀 → 8조 × 4팀
  await seedPrelim(CHALL_DIV, '챌린저부', 8, 4)
  console.log('\n✅ 전체 예선 시딩 완료!')
}

main().catch(console.error)
