import type { DivisionInfo } from './types'

// ─── 부서 선택 ──────────────────────────────────────

/** 부서 번호 파싱 (1-based) */
export function parseSelectDivision(
  input: string,
  divisions: DivisionInfo[],
): { divisionIndex: number } | { error: string } {
  const num = parseInt(input.trim(), 10)
  if (isNaN(num) || num < 1 || num > divisions.length) {
    return { error: `1~${divisions.length} 사이의 번호를 입력해주세요.` }
  }
  return { divisionIndex: num - 1 }
}

// ─── 대회 선택 (복수 검색 결과) ────────────────────────

/** 대회 번호 파싱 (1-based) */
export function parseSelectTournament(
  input: string,
  count: number,
): { tournamentIndex: number } | { error: string } {
  const num = parseInt(input.trim(), 10)
  if (isNaN(num) || num < 1 || num > count) {
    return { error: `1~${count} 사이의 번호를 입력해주세요.` }
  }
  return { tournamentIndex: num - 1 }
}

// ─── 확인 (예/아니오) ────────────────────────────────

export type ConfirmAnswer = 'yes' | 'no' | 'edit' | null

/** 확인 응답 파싱 */
export function parseConfirm(input: string): ConfirmAnswer {
  const normalized = input.trim().toLowerCase()
  if (['예', '네', 'yes', 'y', 'ㅇ', '확인'].includes(normalized)) return 'yes'
  if (['아니오', '아니요', '아니', 'no', 'n', 'ㄴ'].includes(normalized)) return 'no'
  if (['수정', '변경', 'edit'].includes(normalized)) return 'edit'
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

/** 파트너 정보 파싱: "김철수, 강남클럽, 900" */
export function parsePartnerInput(
  input: string,
): { name: string; club: string; rating: number } | { error: string } {
  const parts = input.split(',').map((s) => s.trim())
  if (parts.length < 3) {
    return { error: '형식: 이름, 클럽명, 레이팅 (예: 김철수, 강남클럽, 900)' }
  }
  const [name, club, ratingStr] = parts
  const rating = parseInt(ratingStr, 10)
  if (!name || !club || isNaN(rating) || rating < 0) {
    return { error: '형식: 이름, 클럽명, 레이팅 (예: 김철수, 강남클럽, 900)' }
  }
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

/** 팀원 입력 파싱: "김철수, 900" 또는 "완료" */
export function parseTeamMemberInput(
  input: string,
):
  | { type: 'member'; name: string; rating: number }
  | { type: 'done' }
  | { error: string } {
  const normalized = input.trim()
  if (['완료', '끝', 'done'].includes(normalized.toLowerCase())) {
    return { type: 'done' }
  }
  const parts = normalized.split(',').map((s) => s.trim())
  if (parts.length < 2) {
    return { error: '형식: 이름, 레이팅 (예: 김철수, 900)\n입력 완료 시 "완료"' }
  }
  const [name, ratingStr] = parts
  const rating = parseInt(ratingStr, 10)
  if (!name || isNaN(rating) || rating < 0) {
    return { error: '형식: 이름, 레이팅 (예: 김철수, 900)\n입력 완료 시 "완료"' }
  }
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

  return `${tournamentTitle}\n참가 가능한 부서:\n${lines.join('\n')}\n\n몇 번 부서에 참가하시겠어요? (취소: "취소")`
}
