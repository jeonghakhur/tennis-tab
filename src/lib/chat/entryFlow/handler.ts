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
import { createEntry, searchPartnerByName } from '@/lib/entries/actions'
import type { EntryFlowResult, EntryFlowSession } from './types'

/** 취소 키워드 */
const CANCEL_KEYWORDS = ['취소', 'cancel', '그만']

/**
 * 단체전 최소 추가 팀원 수 계산 (신청자 본인 제외)
 * - TEAM_DOUBLES: 경기 수 × 2명 → 신청자 제외 = (count×2 - 1)
 * - TEAM_SINGLES: 경기 수 × 1명 → 신청자 제외 = (count - 1)
 */
function calcMinAdditionalMembers(
  matchType: import('@/lib/supabase/types').MatchType | null,
  teamMatchCount: number | null,
): number {
  if (!teamMatchCount) return 1
  const total = matchType === 'TEAM_DOUBLES' ? teamMatchCount * 2 : teamMatchCount
  return Math.max(1, total - 1)
}

/** 활성 세션의 메시지 처리 (Gemini 스킵) */
export async function handleEntryFlow(
  userId: string,
  message: string,
): Promise<EntryFlowResult> {
  const session = await getSession(userId)
  if (!session) {
    return {
      success: false,
      message: '세션이 만료되었습니다. 다시 참가 신청을 시작해주세요.',
      flowActive: false,
    }
  }

  // 취소 처리
  if (CANCEL_KEYWORDS.includes(message.trim().toLowerCase())) {
    await deleteSession(userId)
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
    case 'SELECT_PARTNER_USER':
      return handleSelectPartnerUserStep(session, message)
    case 'INPUT_CLUB_NAME':
      return handleInputClubNameStep(session, message)
    case 'INPUT_TEAM_ORDER':
      return handleInputTeamOrderStep(session, message)
    case 'INPUT_TEAM_MEMBERS':
      return handleInputTeamMembersStep(session, message)
    case 'CONFIRM':
      return handleConfirmStep(session, message)
    default:
      await deleteSession(session.userId)
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
    await deleteSession(session.userId)
    return { success: false, message: '대회 정보가 없습니다.', flowActive: false }
  }

  const parsed = parseSelectTournament(message, results)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  const selected = results[parsed.tournamentIndex]

  // 부서 목록 조회
  const divisions = await getDivisionsWithCounts(selected.id)
  if (divisions.length === 0) {
    await deleteSession(session.userId)
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
  session.data.teamMatchCount = selected.teamMatchCount
  session.data.bankAccount = selected.bankAccount
  session.data.divisions = divisions
  session.data.searchResults = undefined
  session.step = 'SELECT_DIVISION'
  await setSession(session.userId, session)

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
    await deleteSession(session.userId)
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
async function routeAfterDivisionSelect(
  session: EntryFlowSession,
  waitlistNotice: string,
): Promise<EntryFlowResult> {
  const { matchType, phone } = session.data

  // 전화번호 없으면 INPUT_PHONE 삽입
  if (!phone) {
    session.step = 'INPUT_PHONE'
    await setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}전화번호를 입력해주세요. (예: 010-1234-5678)`,
      flowActive: true,
    }
  }

  // 복식 → 파트너 입력
  if (matchType === 'INDIVIDUAL_DOUBLES') {
    session.step = 'INPUT_PARTNER'
    await setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}파트너 정보를 입력해주세요.\n형식: 이름, 클럽명, 점수 (예: 김철수, 강남클럽, 900)`,
      flowActive: true,
    }
  }

  // 단체전 → 클럽명 입력
  if (matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') {
    session.step = 'INPUT_CLUB_NAME'
    await setSession(session.userId, session)
    return {
      success: true,
      message: `${waitlistNotice ? waitlistNotice + '\n\n' : ''}클럽명을 입력해주세요.`,
      flowActive: true,
    }
  }

  // 개인전 단식 → 바로 확인
  session.step = 'CONFIRM'
  await setSession(session.userId, session)
  return {
    success: true,
    message: buildConfirmMessage(session, waitlistNotice),
    flowActive: true,
  }
}

// ─── INPUT_PHONE ─────────────────────────────────────

async function handleInputPhoneStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const parsed = parsePhone(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.phone = parsed.phone

  // 전화번호 입력 후 경기 타입별 분기 (routeAfterDivisionSelect 재사용)
  return routeAfterDivisionSelect(session, '')
}

// ─── INPUT_PARTNER (복식) ────────────────────────────

async function handleInputPartnerStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const parsed = parsePartnerInput(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.partnerData = parsed

  // 이름으로 시스템 유저 검색
  const matches = await searchPartnerByName(parsed.name)
  const nameMatches = matches.filter((u) => u.name === parsed.name)

  if (nameMatches.length === 0) {
    // 미등록 파트너 → 텍스트 정보만 저장
    session.data.partnerUserId = null
  } else if (nameMatches.length === 1) {
    // 1명 정확 매칭 → 자동 연결
    session.data.partnerUserId = nameMatches[0].id
  } else {
    // 동명이인 → 입력한 클럽으로 필터
    const clubMatches = nameMatches.filter((u) => u.club === parsed.club)

    if (clubMatches.length === 1) {
      // 클럽까지 일치 → 자동 연결
      session.data.partnerUserId = clubMatches[0].id
    } else if (clubMatches.length === 0) {
      // 클럽 매칭 없음 → 연결 포기
      session.data.partnerUserId = null
    } else {
      // 동일 클럽 내 동명이인 → 생년으로 선택 요청
      session.data.partnerCandidates = clubMatches.map((u) => ({
        id: u.id,
        name: u.name,
        club: u.club,
        birthYear: u.birthYear,
      }))
      session.step = 'SELECT_PARTNER_USER'
      await setSession(session.userId, session)

      const list = clubMatches
        .map((u, i) => {
          const birthLabel = u.birthYear ? `${u.birthYear}년생` : '생년 미상'
          return `${i + 1}. ${u.name} (${u.club ?? ''}, ${birthLabel})`
        })
        .join('\n')

      return {
        success: true,
        message: `같은 클럽에 동명이인이 있습니다. 파트너를 선택해주세요:\n${list}\n\n번호를 입력하세요. 연결 없이 진행하려면 "0"`,
        flowActive: true,
      }
    }
  }

  session.step = 'CONFIRM'
  await setSession(session.userId, session)

  return {
    success: true,
    message: buildConfirmMessage(session, ''),
    flowActive: true,
  }
}

// ─── SELECT_PARTNER_USER (동명이인 선택) ─────────────

async function handleSelectPartnerUserStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const candidates = session.data.partnerCandidates ?? []
  const m = message.trim()
  const num = parseInt(m, 10)

  if (m === '0') {
    // 연결 없이 진행
    session.data.partnerUserId = null
  } else if (!isNaN(num) && num >= 1 && num <= candidates.length) {
    session.data.partnerUserId = candidates[num - 1].id
  } else {
    return {
      success: true,
      message: `1~${candidates.length} 사이 번호를 입력하거나, "0"을 입력하면 연결 없이 진행합니다.`,
      flowActive: true,
    }
  }

  session.data.partnerCandidates = undefined
  session.step = 'CONFIRM'
  await setSession(session.userId, session)

  return {
    success: true,
    message: buildConfirmMessage(session, ''),
    flowActive: true,
  }
}

// ─── INPUT_CLUB_NAME (단체전) ────────────────────────

async function handleInputClubNameStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const clubName = message.trim()
  if (!clubName || clubName.length < 2) {
    return { success: true, message: '클럽명을 2자 이상 입력해주세요.', flowActive: true }
  }

  session.data.clubName = clubName
  session.step = 'INPUT_TEAM_ORDER'
  await setSession(session.userId, session)

  return {
    success: true,
    message: '팀 순서를 입력해주세요 (가/나/다). 자동 설정: "자동"',
    flowActive: true,
  }
}

// ─── INPUT_TEAM_ORDER (단체전) ───────────────────────

async function handleInputTeamOrderStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const parsed = parseTeamOrder(message)
  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  session.data.teamOrder = parsed.order
  session.data.teamMembers = []
  session.step = 'INPUT_TEAM_MEMBERS'
  await setSession(session.userId, session)

  const minAdditional = calcMinAdditionalMembers(session.data.matchType, session.data.teamMatchCount)
  const minTotal = minAdditional + 1 // 신청자 포함
  return {
    success: true,
    message: `팀원을 등록합니다 (신청자 포함 최소 ${minTotal}명).\n형식: 이름 점수 (예: 김철수 900 또는 김철수, 900점)\n입력 완료 시 "완료"`,
    flowActive: true,
  }
}

// ─── INPUT_TEAM_MEMBERS (단체전) ─────────────────────

async function handleInputTeamMembersStep(
  session: EntryFlowSession,
  message: string,
): Promise<EntryFlowResult> {
  const trimmed = message.trim()

  // 쉼표 포함 → 다중 입력 처리
  if (trimmed.includes(',')) {
    return handleMultipleTeamMembers(session, trimmed)
  }

  // 단일 입력
  const parsed = parseTeamMemberInput(trimmed)

  if ('error' in parsed) {
    return { success: true, message: parsed.error, flowActive: true }
  }

  if (parsed.type === 'done') {
    return finishTeamMembersInput(session)
  }

  if (!session.data.teamMembers) session.data.teamMembers = []
  session.data.teamMembers.push({ name: parsed.name, rating: parsed.rating })
  await setSession(session.userId, session)

  const count = session.data.teamMembers.length
  const minAdditional = calcMinAdditionalMembers(session.data.matchType, session.data.teamMatchCount)
  const minTotal = minAdditional + 1
  return {
    success: true,
    message: `팀원 ${count}: ${parsed.name}(${parsed.rating}점) 등록. (신청자 포함 ${count + 1}/${minTotal}명)\n계속 입력하거나 "완료"`,
    flowActive: true,
  }
}

/** 쉼표 구분 다중 팀원 입력 처리 */
async function handleMultipleTeamMembers(
  session: EntryFlowSession,
  input: string,
): Promise<EntryFlowResult> {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)

  const added: { name: string; rating: number }[] = []
  const failed: string[] = []

  for (const part of parts) {
    const parsed = parseTeamMemberInput(part)
    if ('error' in parsed || parsed.type === 'done') {
      failed.push(part)
    } else {
      added.push({ name: parsed.name, rating: parsed.rating })
    }
  }

  if (!session.data.teamMembers) session.data.teamMembers = []
  session.data.teamMembers.push(...added)
  await setSession(session.userId, session)

  const total = session.data.teamMembers.length + 1 // +1: 신청자 본인
  const minAdditional = calcMinAdditionalMembers(session.data.matchType, session.data.teamMatchCount)
  const minTotal = minAdditional + 1

  const lines: string[] = []
  if (added.length > 0) {
    lines.push(`${added.length}명 등록: ${added.map((m) => `${m.name}(${m.rating}점)`).join(', ')}`)
    lines.push(`신청자 포함 총 ${total}/${minTotal}명`)
  }
  if (failed.length > 0) {
    lines.push(`⚠️ 형식 오류 (재입력 필요): ${failed.join(', ')}`)
    lines.push(`형식: 이름 점수 (예: 김철수 900)`)
  }
  lines.push(`계속 입력하거나 "완료"`)

  return { success: true, message: lines.join('\n'), flowActive: true }
}

/** 팀원 입력 완료 처리 */
async function finishTeamMembersInput(session: EntryFlowSession): Promise<EntryFlowResult> {
  const members = session.data.teamMembers ?? []
  const minAdditional = calcMinAdditionalMembers(session.data.matchType, session.data.teamMatchCount)
  if (members.length < minAdditional) {
    const minTotal = minAdditional + 1
    return {
      success: true,
      message: `신청자 포함 최소 ${minTotal}명이 필요합니다. 현재 ${members.length + 1}명 등록됨.\n팀원을 더 입력해주세요.`,
      flowActive: true,
    }
  }

  session.step = 'CONFIRM'
  await setSession(session.userId, session)
  return {
    success: true,
    message: buildConfirmMessage(session, ''),
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
    await deleteSession(session.userId)
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
    await deleteSession(session.userId)
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
    partnerUserId: data.partnerUserId,
    teamMembers: data.teamMembers,
  })

  await deleteSession(session.userId)

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
    lines.push(`⭐ 점수: ${data.playerRating}`)
  }

  // 복식 파트너
  if (data.partnerData) {
    lines.push(`\n👥 파트너: ${data.partnerData.name} (${data.partnerData.club}, ${data.partnerData.rating}점)`)
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
        lines.push(`  ${i + 1}. ${m.name} (${m.rating}점)`)
      })
    }
  }

  if (data.entryFee > 0) {
    lines.push(`\n💰 참가비: ${formatEntryFee(data.entryFee)}`)
  }

  lines.push('\n위 정보로 신청할까요? (예/아니오/취소)')

  return lines.join('\n')
}
