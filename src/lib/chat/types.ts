/** 지원 Intent */
export type Intent =
  | 'SEARCH_TOURNAMENT'
  | 'VIEW_BRACKET'
  | 'VIEW_RESULTS'
  | 'VIEW_REQUIREMENTS'
  | 'APPLY_TOURNAMENT'
  | 'CANCEL_ENTRY'
  | 'VIEW_AWARDS'
  | 'HELP'

/** Gemini가 반환하는 Intent 분류 결과 */
export interface IntentClassification {
  intent: Intent
  entities: ChatEntities
  confidence: number
  requires_auth: boolean
}

/** 추출된 엔티티 */
export interface ChatEntities {
  tournament_name?: string
  location?: string
  date_range?: {
    start?: string
    end?: string
  }
  date_expression?: string
  player_name?: string
  status?: string
  /** "my" = 본인 데이터 조회, "all" = 전체 (기본값) */
  scope?: 'my' | 'all'
  /** scope: "my" 일 때 — 신청 상태 필터 */
  entry_status?: string
  /** scope: "my" 일 때 — 결제 상태 필터 */
  payment_status?: string
  /** SEARCH_TOURNAMENT 응답 상세 수준:
   *  list = 대회명+상태만 (기본), schedule = 날짜+장소 포함, detail = 전체 상세 */
  query_type?: 'list' | 'schedule' | 'detail'
  /** VIEW_AWARDS: 특정 선수 이름 필터 */
  award_player_name?: string
  /** VIEW_AWARDS: 특정 연도 필터 */
  award_year?: number
  /** VIEW_AWARDS: 입상 등급 필터 (우승|준우승|3위|공동3위) */
  award_rank?: string
}

/** Intent Handler 반환 결과 */
export interface HandlerResult {
  success: boolean
  data?: unknown
  message: string
  links?: Array<{
    label: string
    href: string
  }>
  /** 참가 신청 플로우 활성 여부 */
  flow_active?: boolean
}

/** 대화 히스토리 메시지 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** POST /api/chat 요청 */
export interface ChatRequest {
  message: string
  session_id?: string
  history?: ChatMessage[]
}

/** POST /api/chat 성공 응답 */
export interface ChatSuccessResponse {
  success: true
  intent?: Intent | string
  message: string
  data?: unknown
  links?: Array<{
    label: string
    href: string
  }>
  /** 참가 신청 플로우 활성 여부 */
  flow_active?: boolean
}

/** POST /api/chat 에러 응답 */
export interface ChatErrorResponse {
  success: false
  error: string
  code: 'RATE_LIMIT' | 'INVALID_INPUT' | 'AUTH_REQUIRED' | 'INTERNAL_ERROR'
}

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse

/** Intent Handler 함수 시그니처 */
export type IntentHandler = (
  entities: ChatEntities,
  userId?: string
) => Promise<HandlerResult>
