import type { DivisionInfo, TournamentSearchResult } from './types'

// ─── 부서 선택 ──────────────────────────────────────

/** 부서 번호 또는 이름 파싱 (1-based) */
export function parseSelectDivision(
  input: string,
  divisions: DivisionInfo[],
): { divisionIndex: number } | { error: string } {
  const trimmed = input.trim()

  // 숫자 입력
  const num = parseInt(trimmed, 10)
  if (!isNaN(num)) {
    if (num < 1 || num > divisions.length) {
      return { error: `1~${divisions.length} 사이의 번호를 입력해주세요.` }
    }
    return { divisionIndex: num - 1 }
  }

  // 이름 부분 일치 (대소문자 무시)
  const keyword = trimmed.toLowerCase()
  const matched = divisions
    .map((d, i) => ({ index: i, name: d.name }))
    .filter(({ name }) => name.toLowerCase().includes(keyword))

  if (matched.length === 0) {
    return { error: `번호(1~${divisions.length}) 또는 부서명 일부를 입력해주세요.` }
  }
  if (matched.length > 1) {
    const names = matched.map((m) => m.name).join(', ')
    return { error: `여러 부서가 일치합니다: ${names}\n더 구체적으로 입력해주세요.` }
  }

  return { divisionIndex: matched[0].index }
}

// ─── 대회 선택 (복수 검색 결과) ────────────────────────

/** 대회 번호 또는 이름 파싱 (1-based) */
export function parseSelectTournament(
  input: string,
  results: TournamentSearchResult[],
): { tournamentIndex: number } | { error: string } {
  const trimmed = input.trim()

  // 숫자 입력
  const num = parseInt(trimmed, 10)
  if (!isNaN(num)) {
    if (num < 1 || num > results.length) {
      return { error: `1~${results.length} 사이의 번호를 입력해주세요.` }
    }
    return { tournamentIndex: num - 1 }
  }

  // 이름 부분 일치
  const keyword = trimmed.toLowerCase()
  const matched = results
    .map((t, i) => ({ index: i, title: t.title }))
    .filter(({ title }) => title.toLowerCase().includes(keyword))

  if (matched.length === 0) {
    return { error: `번호(1~${results.length}) 또는 대회명 일부를 입력해주세요.` }
  }
  if (matched.length > 1) {
    const titles = matched.map((m) => m.title).join(', ')
    return { error: `여러 대회가 일치합니다: ${titles}\n더 구체적으로 입력해주세요.` }
  }

  return { tournamentIndex: matched[0].index }
}

// ─── 확인 (예/아니오) ────────────────────────────────

export type ConfirmAnswer = 'yes' | 'no' | 'edit' | null

const CONFIRM_YES = new Set(['예', '네', 'yes', 'y', 'ㅇ', 'ㅇㅇ', '확인'])
const CONFIRM_NO = new Set(['아니오', '아니요', '아니', 'no', 'n', 'ㄴ', 'ㄴㄴ'])
const CONFIRM_EDIT = new Set(['수정', '변경', 'edit', '고쳐', '바꿔'])

/** 확인 응답 파싱 */
export function parseConfirm(input: string): ConfirmAnswer {
  const m = input.trim().toLowerCase()
  if (CONFIRM_YES.has(m)) return 'yes'
  if (CONFIRM_NO.has(m)) return 'no'
  if (CONFIRM_EDIT.has(m)) return 'edit'
  return null
}

// ─── 전화번호 ────────────────────────────────────────

/** 전화번호 파싱 + 간단 검증 */
export function parsePhone(input: string): { phone: string } | { error: string } {
  // 숫자, 하이픈만 남기기
  const cleaned = input.trim().replace(/[^0-9-]/g, '').replace(/-/g, '')
  if (!/^01[0-9]{8,9}$/.test(cleaned)) {
    return { error: '올바른 전화번호를 입력해주세요. (예: 010-1234-5678)' }
  }
  // 포맷팅: 010-XXXX-XXXX
  const formatted = cleaned.length === 11
    ? `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    : `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  return { phone: formatted }
}

// ─── 복식 파트너 ─────────────────────────────────────

/** 파트너 정보 파싱: "김철수, 강남클럽, 900" 또는 "김철수 강남클럽 900점" */
export function parsePartnerInput(
  input: string,
): { name: string; club: string; rating: number } | { error: string } {
  const FORMAT_ERR = '형식: 이름, 클럽명, 점수 (예: 김철수, 강남클럽, 900)'
  // 점 suffix 제거 후 쉼표·공백 기준으로 파싱
  const cleaned = input.replace(/(\d+)점\b/, '$1')
  const parts = cleaned.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 3) return { error: FORMAT_ERR }
  // 마지막이 숫자 = 점수, 나머지는 이름·클럽 (이름 1토큰, 클럽 1토큰 가정)
  const ratingStr = parts[parts.length - 1]
  const club = parts[parts.length - 2]
  const name = parts.slice(0, parts.length - 2).join(' ')
  const rating = parseInt(ratingStr, 10)
  if (!name || !club || isNaN(rating) || rating < 0) return { error: FORMAT_ERR }
  return { name, club, rating }
}

// ─── 단체전: 팀 순서 ────────────────────────────────

const VALID_ORDERS = ['가', '나', '다', '라', '마', '바', '사', '아'] as const

/** 팀 순서 파싱: "가"/"나"/"자동" */
export function parseTeamOrder(
  input: string,
): { order: string | null } | { error: string } {
  const normalized = input.trim()
  if (['자동', 'auto'].includes(normalized.toLowerCase())) {
    return { order: null } // null = 자동 설정
  }
  if (VALID_ORDERS.includes(normalized as typeof VALID_ORDERS[number])) {
    return { order: normalized }
  }
  return { error: '팀 순서를 입력해주세요 (가/나/다). 자동 설정: "자동"' }
}

// ─── 단체전: 팀원 ──────────────────────────────────

/**
 * 팀원 입력 파싱: "김철수, 900" / "김철수 900" / "김철수 900점" 또는 "완료"
 * 이름(공백 포함 가능) + 마지막 숫자(점수) 패턴을 regex로 추출
 */
export function parseTeamMemberInput(
  input: string,
):
  | { type: 'member'; name: string; rating: number }
  | { type: 'done' }
  | { error: string } {
  const normalized = input.trim()
  const FORMAT_ERR = '형식: 이름 점수 (예: 김철수 900 또는 김철수, 900점)\n입력 완료 시 "완료"'

  if (['완료', '끝', 'done'].includes(normalized.toLowerCase())) {
    return { type: 'done' }
  }

  // "이름[구분자]+숫자[점]?" 패턴 (구분자: 쉼표·공백 1개 이상)
  const match = normalized.match(/^(.+?)[\s,]+(\d+)점?$/)
  if (!match) return { error: FORMAT_ERR }

  const name = match[1].trim()
  const rating = parseInt(match[2], 10)
  if (!name || isNaN(rating) || rating < 0) return { error: FORMAT_ERR }

  return { type: 'member', name, rating }
}

// ─── 메시지 포맷팅 헬퍼 ─────────────────────────────

/** DB 날짜(ISO/timestamp) → "2026.04.25" 형식 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

/** 참가비 포맷팅 */
export function formatEntryFee(fee: number): string {
  if (fee === 0) return '무료'
  return `${fee.toLocaleString('ko-KR')}원`
}

/** 부서 목록 메시지 생성 */
export function buildDivisionListMessage(
  tournamentTitle: string,
  entryFee: number,
  divisions: DivisionInfo[],
): string {
  const lines = divisions.map((d, i) => {
    const capacityStr = d.maxTeams
      ? `(${d.currentCount}/${d.maxTeams}팀)`
      : `(${d.currentCount}팀)`
    return `${i + 1}. ${d.name} ${capacityStr} - 참가비 ${formatEntryFee(entryFee)}`
  })

  return `${tournamentTitle}\n참가 가능한 부서:\n${lines.join('\n')}\n\n번호 또는 부서명으로 선택해주세요. (취소: "취소")`
}
