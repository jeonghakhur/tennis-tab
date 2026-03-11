const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://tigqwrehpzwaksnvcrrx.supabase.co', 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3')

const TID        = 'e608dacb-6b07-4e5b-8451-77ef71050ae3'
const MASTER_DIV = '80cfb874-648f-4139-acf5-675da21f6d95'
const CHALL_DIV  = '9747b444-d0d4-4b50-9448-946295f86565'
const ADMIN_UID  = 'e472e215-dfa2-4215-a996-4cb29b66e073'

// 팀 이름 (50개)
const teamNames = [
  '한강독수리','마포테니스A','건승회 1팀','건승회 2팀','망원라켓클럽',
  '홍대테니스단','상암스매시','성산레인저','합정에이스','공덕서브킹',
  '아현발리팀','마포구청팀','연세라켓단','이화테니스팀','신촌스피드',
  '서강스트로크','노고산포핸드','대흥그랜드슬램','도화팀','염리ACE',
  '용강챔피언','토정스매셔','창전테니스','구수발리어','서교파이터',
  '동교테니스','연남스피너','성미산레인저','월드컵테니스','상수에이스',
  '당인스마시','밤섬테니스단','와우테니스클럽','마포파이터','한강점프',
  '망원스트로크','홍대에이스팀','합정발리단','성산테니스B','상암파워팀',
  '공덕라켓단','아현ACE팀','마포스피드A','마포스피드B','연세파이터',
  '이화스매시','신촌테니스B','서강에이스B','노고산ACE','대흥발리단'
]

// 팀장 이름 (50개 - 중복 없음)
const captains = [
  '김태양','이서준','박재현','최민혁','정승우',
  '강동현','조형준','윤성민','장태현','임건호',
  '한재원','오준혁','서민준','신동욱','권성훈',
  '황재영','안민호','송재현','류승현','전성준',
  '김성진','이재호','박준혁','최동현','정진우',
  '강민성','조성현','윤재민','장동윤','임성호',
  '한민준','오재현','서준서','신성민','권재원',
  '황성진','안동현','송민규','류재원','전동현',
  '김동혁','이민우','박성민','최재현','정동욱',
  '강재호','조동현','윤민성','장준혁','임재민'
]

// 팀원 이름 풀 (100개)
const memberPool = [
  '손민준','배재현','표준혁','노성민','허동현','진재원','엄민호','채성진','방동욱','봉재영',
  '남성훈','경재호','구민성','편준서','변재현','위성민','석동현','탁재원','소민준','기준혁',
  '마재영','예성민','담동현','비재호','초준혁','겸민성','달재원','봄성진','빛재현','솔민준',
  '온동현','별재영','빛민호','샘재현','솔성민','밝준혁','참재호','빛민성','온재원','꿈성진',
  '하재민','주동현','나준혁','다재영','라민호','마재현','바성민','사동현','아재호','자준혁',
  '황민준','강재현','서동현','박재영','이민호','최재현','정성민','김동현','조재호','윤준혁',
  '장민성','임재원','한성진','오재민','서준서','신동현','권재영','안민호','송성민','류동현',
  '전재호','김준혁','이민성','박재원','최성진','정재민','강동현','조준혁','윤재영','장민호',
  '임성민','한동현','오재호','서준혁','신민성','권재원','안성진','송재민','류준혁','전재영',
  '김민호','이성민','박동현','최재호','정준혁','강민성','조재원','윤성진','장재민','임준혁'
]

const rng = (min,max) => Math.floor(Math.random()*(max-min+1))+min
let memberIdx = 0

function makeTeam(idx) {
  const clubName = teamNames[idx % teamNames.length]
  const captain = captains[idx % captains.length]
  const members = Array.from({length:5}, () => ({
    name: memberPool[memberIdx++ % memberPool.length],
    rating: rng(2,8)
  }))
  return {
    player_name: captain,
    club_name: clubName,
    player_rating: rng(3,9),
    team_members: members,
    applicant_participates: true,
    phone: `010-${rng(1000,9999)}-${rng(1000,9999)}`
  }
}

async function seed() {
  // 기존 삭제
  await sb.from('tournament_entries').delete().in('division_id',[MASTER_DIV, CHALL_DIV])
  console.log('🗑️ 기존 entries 삭제')

  // 마스터부 16팀
  const masterEntries = Array.from({length:16}, (_,i) => ({
    tournament_id: TID, division_id: MASTER_DIV,
    user_id: ADMIN_UID, status: 'CONFIRMED', payment_status: 'FREE',
    ...makeTeam(i)
  }))
  const {data: md, error: me} = await sb.from('tournament_entries').insert(masterEntries).select('id,player_name')
  if (me) { console.error('마스터부 오류:', me); return }
  console.log(`✅ 마스터부 ${md.length}팀:`, md.map(e=>e.player_name).join(', '))

  // 챌린저부 32팀
  const challEntries = Array.from({length:32}, (_,i) => ({
    tournament_id: TID, division_id: CHALL_DIV,
    user_id: ADMIN_UID, status: 'CONFIRMED', payment_status: 'FREE',
    ...makeTeam(i+20)  // 다른 팀 이름/선수 사용
  }))
  const {data: cd, error: ce} = await sb.from('tournament_entries').insert(challEntries).select('id,player_name')
  if (ce) { console.error('챌린저부 오류:', ce); return }
  console.log(`✅ 챌린저부 ${cd.length}팀:`, cd.map(e=>e.player_name).join(', '))
}

seed().catch(console.error)
