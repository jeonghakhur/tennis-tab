import type { MatchType } from '@/lib/supabase/types'

/** 참가 신청 플로우 단계 */
export type EntryFlowStep =
  | 'SELECT_TOURNAMENT'    // 대회 여러 개 검색됨 → 선택
  | 'SELECT_DIVISION'      // 부서 선택
  | 'INPUT_PHONE'          // 전화번호 입력 (프로필에 없을 때)
  | 'INPUT_PARTNER'        // 파트너 입력 (복식)
  | 'INPUT_CLUB_NAME'      // 클럽명 입력 (단체전)
  | 'INPUT_TEAM_ORDER'     // 팀 순서 입력 (단체전)
  | 'INPUT_TEAM_MEMBERS'   // 팀원 입력 (단체전)
  | 'CONFIRM'              // 최종 확인
  | 'COMPLETED'            // 완료

/** 부서 정보 (참가 인원 포함) */
export interface DivisionInfo {
  id: string
  name: string
  maxTeams: number | null
  currentCount: number
}

/** 대회 검색 결과 (진입 시 사용) */
export interface TournamentSearchResult {
  id: string
  title: string
  matchType: MatchType | null
  startDate: string
  entryFee: number
  bankAccount: string | null
}

/** 축적된 참가 신청 데이터 */
export interface EntryFlowData {
  // 대회 정보
  tournamentId: string
  tournamentTitle: string
  matchType: MatchType | null
  entryFee: number
  bankAccount: string | null

  // 부서 정보
  divisionId?: string
  divisionName?: string

  // 프로필 기반 자동 입력
  playerName: string
  phone: string
  playerRating: number | null

  // 복식 파트너
  partnerData?: { name: string; club: string; rating: number } | null

  // 단체전
  clubName?: string | null
  teamOrder?: string | null
  teamMembers?: Array<{ name: string; rating: number }>

  // SELECT_DIVISION에서 사용할 부서 목록
  divisions: DivisionInfo[]

  // 검색된 대회 목록 (복수 결과 시)
  searchResults?: TournamentSearchResult[]
}

/** 참가 신청 플로우 세션 */
export interface EntryFlowSession {
  userId: string
  step: EntryFlowStep
  data: EntryFlowData
  createdAt: number
  updatedAt: number
}

/** 플로우 핸들러 반환 타입 */
export interface EntryFlowResult {
  success: boolean
  message: string
  /** true면 플로우 진행 중, false면 플로우 종료 */
  flowActive: boolean
  links?: Array<{ label: string; href: string }>
}
