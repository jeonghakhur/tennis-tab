/** 취소 플로우 단계 */
export type CancelFlowStep = 'SELECT_ENTRY' | 'CONFIRM_CANCEL'

/** 취소 가능한 신청 정보 */
export interface CancelableEntry {
  id: string
  tournamentId: string
  tournamentTitle: string
  divisionName: string
  status: string
  paymentStatus: string
}

/** 취소 플로우 세션 */
export interface CancelFlowSession {
  userId: string
  step: CancelFlowStep
  entries: CancelableEntry[]
  selectedEntry?: CancelableEntry
  createdAt: number
  updatedAt: number
}

/** 취소 플로우 핸들러 반환 타입 */
export interface CancelFlowResult {
  success: boolean
  message: string
  /** true면 플로우 진행 중, false면 플로우 종료 */
  flowActive: boolean
  links?: Array<{ label: string; href: string }>
}
