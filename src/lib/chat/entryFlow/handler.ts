import { getSession, setSession, deleteSession } from './sessionStore'
import { getDivisionsWithCounts, checkExistingEntry } from './queries'
import {
  parseSelectDivision,
  parseSelectTournament,
  parseConfirm,
  parsePhone,
  parsePartnerInput,
  parseTeamOrder,
  parseTeamMemberInput,
  formatEntryFee,
  buildDivisionListMessage,
} from './steps'
import { createEntry } from '@/lib/entries/actions'
import type { EntryFlowResult, EntryFlowSession } from './types'

/** 취소 키워드 */
const CANCEL_KEYWORDS = ['취소', 'cancel', '그만']

/** 활성 세션의 메시지 처리 (Gemini 스킵) */
export async function handleEntryFlow(
  userId: string,
  message: string,
): Promise<EntryFlowResult> {
  const session = getSession(userId)
  if (!session) {
    return {
      success: false,
      message: '세션이 만료되었습니다. 다시 참가 신청을 시작해주세요.',
      flowActive: false,
    }
  }

  // 취소 처리
  if (CANCEL_KEYWORDS.includes(message.trim().toLowerCase())) {
    deleteSession(userId)
    return {
      success: true,
      message: '참가 신청을 취소했습니다.',
      flowActive: false,
    }
  }

  switch (session.step) {
    case 'SELECT_TOURNAMENT':
      return handleSelectTournamentStep(session, message)
    case 'SELECT_DIVISION':
      return handleSelectDivisionStep(session, message)
    case 'INPUT_PHONE':
      return handleInputPhoneStep(session, message)
    case 'INPUT_PARTNER':
      return handleInputPartnerStep(session, message)
    case 'INPUT_CLUB_NAME':
      return handleInputClubNameStep(session, message)
    case 'INPUT_TEAM_ORDER':
      return handleInputTeamOrderStep(session, message)
    case 'INPUT_TEAM_MEMBERS':
      return handleInputTeamMembersStep(session, message)
    case 'CONFIRM':
      return handleConfirmStep(session, message)
    default:
      deleteSession(session.userId)
      return {
        success: false,
        message: '알 수 없는 상태입니다. 다시 시작해주세요.',
        flowActive: false,
      }
  }
}

// ─── SELECT_TOURNAMENT (복수 검색 결과) ──────────────

async function handleSelectTournamentStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const results = session.data.searchResults
  if (!results || results.length === 0) {
    deleteSession(session.userId)
    return { success: false, message: '대회 정보가 없습니다.', flowActive: false }
  }

  const parsed = parseSelectTournament(message, results.length)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  const selected = results[parsed.tournamentIndex]

  // 부서 목록 조회
  const divisions = await getDivisionsWithCounts(selected.id)
  if (divisions.length === 0) {
    deleteSession(session.userId)
    return {
      success: true,
      message: `${selected.title}에 참가 가능한 부서가 없습니다.`,
      flowActive: false,
    }
  }

  // 세션 업데이트
  session.data.tournamentId = selected.id
  session.data.tournamentTitle = selected.title
  session.data.matchType = selected.matchType
  session.data.entryFee = selected.entryFee
  session.data.bankAccount = selected.bankAccount
  session.data.divisions = divisions
  session.data.searchResults = undefined
  session.step = 'SELECT_DIVISION'
  setSession(session.userId, session)

  return {
    success: true,
    message: buildDivisionListMessage(selected.title, selected.entryFee, divisions),
    flowActive: true,
  }
}

// ─── SELECT_DIVISION ─────────────────────────────────

async function handleSelectDivisionStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const { divisions } = session.data
  const parsed = parseSelectDivision(message, divisions)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  const selected = divisions[parsed.divisionIndex]

  // 중복 신청 확인
  const exists = await checkExistingEntry(
    session.data.tournamentId,
    session.userId,
    selected.id,
  )
  if (exists) {
    deleteSession(session.userId)
    return {
      success: true,
      message: `이미 ${selected.name} 부서에 참가 신청하셨습니다.`,
      flowActive: false,
      links: [{ label: '내 신청 확인', href: '/my/entries' }],
    }
  }

  // 정원 초과 안내 (확정 인원 기준은 서버에서 최종 판단, 여기는 참고용)
  let waitlistNotice = ''
  if (selected.maxTeams && selected.currentCount >= selected.maxTeams) {
    waitlistNotice = '\n⚠️ 현재 정원이 가득 찼습니다. 대기자로 등록될 수 있습니다.'
  }

  session.data.divisionId = selected.id
  session.data.divisionName = selected.name

  // 경기 타입에 따른 다음 step 분기
  return routeAfterDivisionSelect(session, waitlistNotice)
}

/** 부서 선택 후 경기 타입별 다음 step 라우팅 */
function routeAfterDivisionSelect(
  session: EntryFlowSession,
  waitlistNotice: string,
): EntryFlowResult {
  const { matchType, phone } = session.data

  // 전화번호 없으면 INPUT_PHONE 삽입
  if (!phone) {
    session.step = 'INPUT_PHONE'
    setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}전화번호를 입력해주세요. (예: 010-1234-5678)`,
      flowActive: true,
    }
  }

  // 복식 → 파트너 입력
  if (matchType === 'INDIVIDUAL_DOUBLES') {
    session.step = 'INPUT_PARTNER'
    setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}파트너 정보를 입력해주세요.\n형식: 이름, 클럽명, 레이팅 (예: 김철수, 강남클럽, 900)`,
      flowActive: true,
    }
  }

  // 단체전 → 클럽명 입력
  if (matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') {
    session.step = 'INPUT_CLUB_NAME'
    setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}클럽명을 입력해주세요.`,
      flowActive: true,
    }
  }

  // 개인전 단식 → 바로 확인
  session.step = 'CONFIRM'
  setSession(session.userId, session)
  return {
    success: true,
    message: buildConfirmMessage(session, waitlistNotice),
    flowActive: true,
  }
}

// ─── INPUT_PHONE ─────────────────────────────────────

function handleInputPhoneStep(
  session: EntryFlowSession,
  message: string,
): EntryFlowResult {
  const parsed = parsePhone(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.phone = parsed.phone

  // 전화번호 입력 후 경기 타입별 분기 (routeAfterDivisionSelect 재사용)
  return routeAfterDivisionSelect(session, '')
}

// ─── INPUT_PARTNER (복식) ────────────────────────────

function handleInputPartnerStep(
  session: EntryFlowSession,
  message: string,
): EntryFlowResult {
  const parsed = parsePartnerInput(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.partnerData = parsed
  session.step = 'CONFIRM'
  setSession(session.userId, session)

  return {
    success: true,
    message: buildConfirmMessage(session, ''),
    flowActive: true,
  }
}

// ─── INPUT_CLUB_NAME (단체전) ────────────────────────

function handleInputClubNameStep(
  session: EntryFlowSession,
  message: string,
): EntryFlowResult {
  const clubName = message.trim()
  if (!clubName || clubName.length < 2) {
    return { success: true, message: '클럽명을 2자 이상 입력해주세요.', flowActive: true }
  }

  session.data.clubName = clubName
  session.step = 'INPUT_TEAM_ORDER'
  setSession(session.userId, session)

  return {
    success: true,
    message: '팀 순서를 입력해주세요 (가/나/다). 자동 설정: "자동"',
    flowActive: true,
  }
}

// ─── INPUT_TEAM_ORDER (단체전) ───────────────────────

function handleInputTeamOrderStep(
  session: EntryFlowSession,
  message: string,
): EntryFlowResult {
  const parsed = parseTeamOrder(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.teamOrder = parsed.order
  session.data.teamMembers = []
  session.step = 'INPUT_TEAM_MEMBERS'
  setSession(session.userId, session)

  return {
    success: true,
    message: '팀원을 등록합니다 (최소 1명).\n형식: 이름, 레이팅 (예: 김철수, 900)\n입력 완료 시 "완료"',
    flowActive: true,
  }
}

// ─── INPUT_TEAM_MEMBERS (단체전) ─────────────────────

function handleInputTeamMembersStep(
  session: EntryFlowSession,
  message: string,
): EntryFlowResult {
  const parsed = parseTeamMemberInput(message)

  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  if (parsed.type === 'done') {
    const members = session.data.teamMembers ?? []
    if (members.length === 0) {
      return {
        success: true,
        message: '최소 1명의 팀원을 등록해야 합니다.\n형식: 이름, 레이팅 (예: 김철수, 900)',
        flowActive: true,
      }
    }

    // 팀원 입력 완료 → 확인 단계
    session.step = 'CONFIRM'
    setSession(session.userId, session)
    return {
      success: true,
      message: buildConfirmMessage(session, ''),
      flowActive: true,
    }
  }

  // 팀원 추가
  if (!session.data.teamMembers) session.data.teamMembers = []
  session.data.teamMembers.push({ name: parsed.name, rating: parsed.rating })
  setSession(session.userId, session)

  const count = session.data.teamMembers.length
  return {
    success: true,
    message: `팀원 ${count}: ${parsed.name}(${parsed.rating}) 등록. 계속 입력하거나 "완료"`,
    flowActive: true,
  }
}

// ─── CONFIRM ─────────────────────────────────────────

async function handleConfirmStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const answer = parseConfirm(message)

  if (answer === 'no' || answer === 'edit') {
    deleteSession(session.userId)
    return {
      success: true,
      message: '참가 신청을 취소했습니다. 다시 시작하려면 대회명을 말씀해주세요.',
      flowActive: false,
    }
  }

  if (answer !== 'yes') {
    return {
      success: true,
      message: '"예" 또는 "아니오"로 답변해주세요.',
      flowActive: true,
    }
  }

  // createEntry 호출
  const { data } = session
  if (!data.divisionId) {
    deleteSession(session.userId)
    return { success: false, message: '부서 정보가 없습니다. 다시 시작해주세요.', flowActive: false }
  }
  const result = await createEntry(data.tournamentId, {
    divisionId: data.divisionId,
    phone: data.phone,
    playerName: data.playerName,
    playerRating: data.playerRating,
    clubName: data.clubName,
    teamOrder: data.teamOrder,
    partnerData: data.partnerData,
    teamMembers: data.teamMembers,
  })

  deleteSession(session.userId)

  if (!result.success) {
    return {
      success: false,
      message: result.error ?? '참가 신청에 실패했습니다.',
      flowActive: false,
    }
  }

  // 성공 메시지
  let successMsg = `참가 신청이 완료되었습니다!\n\n📋 ${data.tournamentTitle} — ${data.divisionName}`
  if (data.entryFee > 0 && data.bankAccount) {
    successMsg += `\n💰 참가비: ${formatEntryFee(data.entryFee)}\n🏦 입금 계좌: ${data.bankAccount}`
  } else if (data.entryFee > 0) {
    successMsg += `\n💰 참가비: ${formatEntryFee(data.entryFee)}`
  }

  return {
    success: true,
    message: successMsg,
    flowActive: false,
    links: [
      { label: '내 신청 확인', href: '/my/entries' },
      { label: '대회 상세', href: `/tournaments/${data.tournamentId}` },
    ],
  }
}

// ─── 확인 메시지 빌더 ───────────────────────────────

function buildConfirmMessage(session: EntryFlowSession, notice: string): string {
  const { data } = session
  const lines: string[] = []

  if (notice) lines.push(notice)

  lines.push('신청 정보를 확인해주세요:\n')
  lines.push(`📋 대회: ${data.tournamentTitle}`)
  lines.push(`📌 부서: ${data.divisionName}`)
  lines.push(`👤 이름: ${data.playerName}`)
  lines.push(`📞 전화: ${data.phone}`)

  if (data.playerRating !== null) {
    lines.push(`⭐ 레이팅: ${data.playerRating}`)
  }

  // 복식 파트너
  if (data.partnerData) {
    lines.push(`\n👥 파트너: ${data.partnerData.name} (${data.partnerData.club}, ${data.partnerData.rating})`)
  }

  // 단체전
  if (data.clubName) {
    lines.push(`\n🏢 클럽: ${data.clubName}`)
    if (data.teamOrder) {
      lines.push(`📊 팀 순서: ${data.teamOrder}`)
    } else {
      lines.push(`📊 팀 순서: 자동`)
    }
    if (data.teamMembers && data.teamMembers.length > 0) {
      lines.push(`\n👥 팀원:`)
      data.teamMembers.forEach((m, i) => {
        lines.push(`  ${i + 1}. ${m.name} (${m.rating})`)
      })
    }
  }

  if (data.entryFee > 0) {
    lines.push(`\n💰 참가비: ${formatEntryFee(data.entryFee)}`)
  }

  lines.push('\n위 정보로 신청할까요? (예/아니오/취소)')

  return lines.join('\n')
}
