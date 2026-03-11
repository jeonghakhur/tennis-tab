// 클럽 관련 타입 정의

export type ClubJoinType = 'OPEN' | 'APPROVAL' | 'INVITE_ONLY'
export type ClubMemberRole = 'OWNER' | 'ADMIN' | 'VICE_PRESIDENT' | 'ADVISOR' | 'MATCH_DIRECTOR' | 'MEMBER'
export type ClubMemberStatus = 'PENDING' | 'INVITED' | 'ACTIVE' | 'LEFT' | 'REMOVED'
export type GenderType = 'MALE' | 'FEMALE'

export interface Club {
  id: string
  name: string
  representative_name: string | null
  description: string | null
  city: string | null
  district: string | null
  address: string | null
  contact_phone: string | null
  contact_email: string | null
  join_type: ClubJoinType
  association_id: string | null
  max_members: number | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  // 순위 기본 조회 기간
  default_ranking_period: string | null
  default_ranking_from: string | null
  default_ranking_to: string | null
  // JOIN 결과
  associations?: { name: string } | null
  _member_count?: number
}

export interface ClubMember {
  id: string
  club_id: string
  user_id: string | null
  is_registered: boolean
  is_primary: boolean
  name: string
  birth_year: string | null
  gender: GenderType | null
  phone: string | null
  start_year: string | null
  rating: number | null
  role: ClubMemberRole
  status: ClubMemberStatus
  status_reason: string | null
  introduction: string | null
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

// Server Action 입력 타입
export interface CreateClubInput {
  name: string
  representative_name: string
  description?: string
  city?: string
  district?: string
  address?: string
  contact_phone: string
  contact_email: string
  join_type?: ClubJoinType
  max_members?: number
  association_id?: string | null
  association_name?: string  // 직접 입력 시 이름으로 협회 찾기/생성
}

export interface UpdateClubInput {
  name?: string
  representative_name?: string
  description?: string
  city?: string
  district?: string
  address?: string
  contact_phone?: string
  contact_email?: string
  join_type?: ClubJoinType
  max_members?: number | null
  association_id?: string | null
  association_name?: string  // 직접 입력 시 이름으로 협회 찾기/생성
}

export interface UnregisteredMemberInput {
  name: string
  birth_year?: string
  gender?: GenderType
  phone?: string
  start_year?: string
  rating?: number
}

export interface ClubFilters {
  search?: string
  city?: string
  district?: string
  association_id?: string
}

// ============================================================
// Club Session 관련 타입
// ============================================================

export type ClubSessionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'COMPLETED'
export type AttendanceStatus = 'ATTENDING' | 'NOT_ATTENDING' | 'UNDECIDED'
export type MatchResultStatus = 'SCHEDULED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED'

export interface ClubSession {
  id: string
  club_id: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string
  start_time: string
  end_time: string
  max_attendees: number | null
  status: ClubSessionStatus
  rsvp_deadline: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // JOIN 결과
  _attending_count?: number
  _not_attending_count?: number
  _undecided_count?: number
  _my_attendance?: AttendanceStatus
}

export interface ClubSessionDetail extends ClubSession {
  attendances: SessionAttendanceDetail[]
  matches: ClubMatchResult[]
  guests: ClubSessionGuest[]
}

export interface SessionAttendanceDetail {
  id: string
  session_id: string
  club_member_id: string
  status: AttendanceStatus
  available_from: string | null
  available_until: string | null
  notes: string | null
  responded_at: string | null
  // JOIN
  member: { id: string; name: string; rating: number | null; is_registered: boolean; gender: 'MALE' | 'FEMALE' | null }
}

// doubles_men/doubles_women/doubles_mixed은 기존 DB 레코드 호환용 (신규 생성은 'doubles' 사용)
export type MatchType = 'singles' | 'doubles' | 'doubles_men' | 'doubles_women' | 'doubles_mixed'

/** 세션에 등록된 게스트 참석자 */
export interface ClubSessionGuest {
  id: string
  session_id: string
  name: string
  gender: 'MALE' | 'FEMALE' | null
  available_from: string | null   // HH:MM:SS (TIME 컬럼)
  available_until: string | null  // HH:MM:SS (TIME 컬럼)
  notes: string | null
  created_by: string
  created_at: string
}

/** 자동 대진 풀에서 멤버 또는 게스트를 나타내는 유니온 타입 */
export type SchedulePlayer =
  | {
      type: 'member'
      id: string         // gameCount 키용 식별자 (memberId)
      memberId: string
      guestId: null
      name: string
      gender: 'MALE' | 'FEMALE' | null
      availableFrom: number  // 분 단위
      availableUntil: number // 분 단위
    }
  | {
      type: 'guest'
      id: string         // gameCount 키용 식별자 (guestId)
      memberId: null
      guestId: string
      name: string
      gender: 'MALE' | 'FEMALE' | null
      availableFrom: number  // 분 단위 (게스트 등록 시간 or 세션 시작 시간)
      availableUntil: number // 분 단위 (게스트 등록 시간 or 세션 종료 시간)
    }

export interface ClubMatchResult {
  id: string
  session_id: string
  match_type: MatchType
  // member 또는 guest 중 하나 설정 (nullable로 변경)
  player1_member_id: string | null
  player2_member_id: string | null
  player1b_member_id?: string | null
  player2b_member_id?: string | null
  player1_guest_id?: string | null
  player2_guest_id?: string | null
  player1b_guest_id?: string | null
  player2b_guest_id?: string | null
  court_number: string | null
  scheduled_time: string | null
  player1_score: number | null
  player2_score: number | null
  winner_member_id: string | null
  status: MatchResultStatus
  player1_reported_score_p1: number | null
  player1_reported_score_p2: number | null
  player2_reported_score_p1: number | null
  player2_reported_score_p2: number | null
  created_at: string
  updated_at: string
  // JOIN: member
  player1?: { id: string; name: string } | null
  player2?: { id: string; name: string } | null
  player1b?: { id: string; name: string } | null
  player2b?: { id: string; name: string } | null
  // JOIN: guest
  player1_guest?: { id: string; name: string } | null
  player2_guest?: { id: string; name: string } | null
  player1b_guest?: { id: string; name: string } | null
  player2b_guest?: { id: string; name: string } | null
}

export interface ClubMemberStat {
  id: string
  club_id: string
  club_member_id: string
  season: string
  total_games: number
  wins: number
  losses: number
  win_rate: number
  sessions_attended: number
  last_played_at: string | null
}

export interface ClubMemberStatWithMember extends ClubMemberStat {
  member: { id: string; name: string; rating: number | null }
}

// Session Server Action 입력 타입
export interface CreateSessionInput {
  club_id: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string
  start_time: string
  end_time: string
  max_attendees?: number
  rsvp_deadline?: string
  notes?: string
}

export type UpdateSessionInput = Partial<Omit<CreateSessionInput, 'club_id'>>

export interface RespondSessionInput {
  session_id: string
  club_member_id: string
  status: AttendanceStatus
  available_from?: string
  available_until?: string
  notes?: string
}

export interface CreateMatchInput {
  session_id: string
  match_type?: MatchType
  // member 또는 guest 중 하나 설정 (각 슬롯에)
  player1_member_id?: string | null
  player2_member_id?: string | null
  player1b_member_id?: string | null
  player2b_member_id?: string | null
  player1_guest_id?: string | null
  player2_guest_id?: string | null
  player1b_guest_id?: string | null
  player2b_guest_id?: string | null
  court_number?: string
  scheduled_time?: string
}

export interface ReportResultInput {
  my_score: number
  opponent_score: number
}

export interface ResolveDisputeInput {
  player1_score: number
  player2_score: number
}

// ─── 모임 댓글 ────────────────────────────────────────────────────────────────

export interface ClubSessionComment {
  id: string
  session_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  // JOIN
  author?: { name: string }
}
