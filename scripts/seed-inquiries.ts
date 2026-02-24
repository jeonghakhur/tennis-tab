/**
 * 1:1 문의 더미 데이터 10건 삽입 스크립트
 * 실행: npx tsx --env-file=.env.local scripts/seed-inquiries.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 환경변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 더미 데이터 10건
const DUMMY_INQUIRIES = [
  {
    category: 'SERVICE',
    title: '대진표 생성 후 참가자 변경이 안 돼요',
    content: '대회를 생성하고 대진표를 만들었는데, 참가자를 변경하려고 하면 버튼이 비활성화됩니다. 대진표 생성 전에만 가능한 기능인가요? 혹시 다른 방법이 있다면 알려주시면 감사하겠습니다.',
  },
  {
    category: 'TOURNAMENT',
    title: '단체전 경기 결과 입력 방법을 모르겠습니다',
    content: '단체전 대회를 주최하고 있는데, 세트별 선수 지정과 점수 입력 방법이 헷갈립니다. 혹시 단체전 경기 관리 가이드나 설명 영상이 있을까요? 첫 대회라서 많이 헤매고 있습니다.',
  },
  {
    category: 'ACCOUNT',
    title: '소셜 로그인 연동 계정 변경 문의',
    content: '기존에 구글 계정으로 가입했는데, 카카오 계정으로 변경하고 싶습니다. 현재 프로필과 대회 기록이 유지된 채로 변경이 가능한지 궁금합니다. 방법이 있다면 알려주세요.',
  },
  {
    category: 'SERVICE',
    title: '클럽 회원 일괄 등록 기능이 있나요?',
    content: '테니스 클럽에 회원이 30명 정도 있는데 한 명씩 등록하기가 번거롭습니다. 엑셀이나 CSV로 일괄 업로드하는 기능이 있으면 좋겠습니다. 현재 지원되는지 알고 싶습니다.',
  },
  {
    category: 'TOURNAMENT',
    title: '대회 참가 취소 후 환불 처리',
    content: '참가 신청한 대회에 개인 사정으로 참가가 어려워졌습니다. 참가 취소는 어떻게 하면 되나요? 참가비 환불은 어디에 문의해야 하나요? 대회 주최자에게 직접 연락해야 하는지요.',
  },
  {
    category: 'ETC',
    title: '모바일 앱 출시 계획이 있나요?',
    content: '테니스탭 서비스를 잘 사용하고 있습니다. 웹에서도 편리하지만 모바일 앱이 있으면 더 좋을 것 같습니다. iOS, Android 앱 출시 계획이 있으신지 궁금합니다.',
  },
  {
    category: 'SERVICE',
    title: '예선 라운드 조별 배정 방식 문의',
    content: '예선 라운드에서 조 편성을 할 때 시드 배정 방식을 설정할 수 있나요? 랭킹 기반으로 자동 배정되는지, 아니면 수동으로 조정 가능한지 알고 싶습니다.',
  },
  {
    category: 'ACCOUNT',
    title: '회원 탈퇴 후 데이터 보존 여부',
    content: '계정을 탈퇴하면 제가 주최한 대회 기록과 참가 기록이 모두 삭제되나요? 혹시 탈퇴 후에도 일정 기간 데이터가 보존되는지, 개인정보처리방침에 명시된 내용을 구체적으로 알고 싶습니다.',
  },
  {
    category: 'TOURNAMENT',
    title: '부전승 처리 기준을 알고 싶습니다',
    content: '대진표에서 부전승(walkover) 처리는 어떻게 하나요? 상대 팀이 기권했을 때 자동으로 처리가 되는지, 아니면 주최자가 수동으로 결과를 입력해야 하는지 알려주세요.',
  },
  {
    category: 'ETC',
    title: '테니스탭 서비스 건의 사항',
    content: '서비스를 사용하면서 느낀 개선 사항을 말씀드립니다. 1) 대회 알림 기능(경기 시간 1시간 전 알림) 2) 참가자별 전적 통계 페이지 3) 클럽 간 친선 경기 기능 추가를 건의드립니다.',
  },
]

async function seedInquiries() {
  console.log('🎾 1:1 문의 더미 데이터 삽입 시작...\n')

  // 1. 기존 사용자 조회 (author_id로 사용할 실제 유저)
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, name, email')
    .limit(5)

  if (profileError || !profiles?.length) {
    console.error('❌ 사용자를 찾을 수 없습니다:', profileError?.message)
    console.log('💡 회원이 한 명 이상 존재해야 합니다.')
    process.exit(1)
  }

  console.log(`✅ 사용자 ${profiles.length}명 확인:`)
  profiles.forEach(p => console.log(`   - ${p.name} (${p.email})`))
  console.log()

  // 2. 더미 문의 삽입 (사용자들에게 랜덤 배분)
  const results = []
  for (let i = 0; i < DUMMY_INQUIRIES.length; i++) {
    const inquiry = DUMMY_INQUIRIES[i]
    const author = profiles[i % profiles.length]

    const { data, error } = await admin
      .from('inquiries')
      .insert({
        ...inquiry,
        author_id: author.id,
        status: i < 3 ? 'RESOLVED' : i < 6 ? 'IN_PROGRESS' : 'PENDING',
        // 3건은 답변 완료 상태로 삽입
        ...(i < 3 && {
          reply_content: '안녕하세요, Tennis Tab 운영팀입니다. 문의 주신 내용을 검토했습니다. 해당 기능은 현재 개선 중이며 빠른 시일 내에 업데이트할 예정입니다. 이용에 불편을 드려 죄송합니다.',
          reply_by: profiles[0].id,
          replied_at: new Date().toISOString(),
        }),
      })
      .select()
      .single()

    if (error) {
      console.error(`❌ [${i + 1}] "${inquiry.title}" 삽입 실패:`, error.message)
    } else {
      const statusLabel = { PENDING: '대기중', IN_PROGRESS: '처리중', RESOLVED: '완료' }[data.status as string] ?? data.status
      console.log(`✅ [${i + 1}] "${inquiry.title}" — ${statusLabel} (by ${author.name})`)
      results.push(data)
    }
  }

  console.log(`\n🎯 완료: ${results.length}/${DUMMY_INQUIRIES.length}건 삽입`)

  // 3. 최종 확인
  const { count } = await admin
    .from('inquiries')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 DB 총 문의 수: ${count}건`)
}

seedInquiries().catch(console.error)
