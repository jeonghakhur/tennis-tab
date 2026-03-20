/**
 * 솔라피(Solapi) 카카오 알림톡 발송 모듈
 *
 * 필요 환경변수:
 *   SOLAPI_API_KEY       - 솔라피 API Key (콘솔 > 개발 정보 > API Key)
 *   SOLAPI_API_SECRET    - 솔라피 API Secret
 *   SOLAPI_PFID          - 카카오 채널 ID (@ 포함, 예: @tennistab)
 *   SOLAPI_SENDER_NUMBER - 등록된 발신번호 (010-xxxx-xxxx)
 *   SOLAPI_TEMPLATE_EXTENSION_REQUEST - 연장 신청 알림 템플릿 ID
 *   SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM - 대회 참가 확정 알림 템플릿 ID
 *   SOLAPI_TEMPLATE_LESSON_APPLY - 레슨 신청 완료 알림 템플릿 ID
 */

import { SolapiMessageService } from 'solapi'

// ── 싱글턴 서비스 인스턴스 ─────────────────────────────────────────────────

let _service: SolapiMessageService | null = null

function getService(): SolapiMessageService | null {
  const apiKey    = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) return null

  if (!_service) {
    _service = new SolapiMessageService(apiKey, apiSecret)
  }
  return _service
}

// ── 공통 타입 ────────────────────────────────────────────────────────────

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ── 대회 참가 확정 알림 ──────────────────────────────────────────────────

export interface TournamentConfirmAlimtalkParams {
  /** 참가자 수신 전화번호 */
  playerPhone: string
  /** 참가자 이름 */
  playerName: string
  /** 대회명 */
  tournamentName: string
  /** 부서명 (예: 남자 단식 A조) */
  divisionName: string
  /** 대회 일시 (예: 2026-04-15 09:00) */
  tournamentDate: string
  /** 장소 */
  venue: string
  /** 대회 상세 페이지 URL */
  detailUrl: string
}

/**
 * 대회 참가 확정 알림톡 발송 (참가자 수신)
 *
 * 알림톡 템플릿 (솔라피 콘솔에서 등록 필요):
 * ───────────────────────────────────────────
 * [강조 제목] #{대회명} 참가 확정
 * [강조 부제목] 참가신청이 확정되었습니다
 *
 * #{고객명}님, 안녕하세요.
 *
 * #{대회명} 참가신청이 확정되었습니다.
 *
 * ■ 대회 정보
 * - 대회명: #{대회명}
 * - 부서: #{부서명}
 * - 대회일시: #{대회일시}
 * - 장소: #{장소}
 *
 * 참가에 감사드립니다.
 * ───────────────────────────────────────────
 * 버튼: [대회 상세보기] → #{상세URL}
 */
export async function sendTournamentConfirmAlimtalk(
  params: TournamentConfirmAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 대회 참가 확정 알림톡:', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.playerPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':   params.playerName,
          '#{대회명}':   params.tournamentName,
          '#{부서명}':   params.divisionName,
          '#{대회일시}': params.tournamentDate,
          '#{장소}':     params.venue,
          '#{상세URL}':  params.detailUrl,
        },
      },
    })

    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 대회 참가 확정:', msg)
    return { success: false, error: msg }
  }
}

// ── 레슨 신청 완료 알림 ──────────────────────────────────────────────────

export interface LessonApplyAlimtalkParams {
  /** 수신 전화번호 */
  phone: string
  /** 고객명 */
  customerName: string
  /** 레슨명 */
  lessonName: string
  /** 강사명 */
  coachName: string
  /** 레슨 시작일 (예: 2026-04-01) */
  lessonStartDate: string
  /** 레슨 정보 (예: 주 2회 / 8회 패키지) */
  lessonInfo: string
  /** 레슨 요일 (예: 월, 수) */
  lessonDays: string
  /** 장소 */
  venue: string
}

/**
 * 레슨 신청 완료 알림톡 발송
 *
 * 알림톡 템플릿 (솔라피 콘솔에서 등록 필요):
 * ───────────────────────────────────────────
 * #{고객명}님, 안녕하세요.
 * #{레슨명} 신청이 완료되었습니다.
 *
 * ■ 레슨 정보
 * - 강사: #{강사명}
 * - 레슨시작일: #{레슨시작일}
 * - 레슨정보: #{레슨정보}
 * - 레슨요일: #{레슨요일}
 * - 장소: #{장소}
 *
 * 신청해 주셔서 감사합니다.
 * ───────────────────────────────────────────
 */
export async function sendLessonApplyAlimtalk(
  params: LessonApplyAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_LESSON_APPLY
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 레슨 신청 완료 알림톡:', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.phone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':     params.customerName,
          '#{레슨명}':     params.lessonName,
          '#{강사명}':     params.coachName,
          '#{레슨시작일}': params.lessonStartDate,
          '#{레슨정보}':   params.lessonInfo,
          '#{레슨요일}':   params.lessonDays,
          '#{장소}':       params.venue,
        },
      },
    })

    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 레슨 신청 완료:', msg)
    return { success: false, error: msg }
  }
}

// ── 대회 참가 신청 알림 ───────────────────────────────────────────────────

export interface TournamentApplyAlimtalkParams {
  /** 참가자 수신 전화번호 */
  playerPhone: string
  /** 참가자 이름 */
  playerName: string
  /** 대회명 */
  tournamentName: string
  /** 부서명 (예: 남자 단식 A조) */
  divisionName: string
  /** 대회 일시 (예: 2026-04-15 09:00) */
  tournamentDate: string
  /** 장소 */
  venue: string
  /** 대회 ID (버튼 URL에 사용: /tournaments/{url}) */
  tournamentId: string
}

/**
 * 대회 참가 신청 알림톡 발송 (신청자 수신)
 *
 * 알림톡 템플릿:
 * ───────────────────────────────────────────
 * 마포구테니스협회 대회 참가 신청 알림
 *
 * #{고객명}님, 안녕하세요.
 * #{대회명} 참가신청이 되었습니다.
 * 참가비 입금 후 꼭 입금확인 버튼을 클릭해주세요.
 *
 * ■ 대회 정보
 * - 대회명: #{대회명}
 * - 부서: #{부서명}
 * - 대회일시: #{대회일시}
 * - 장소: #{장소}
 *
 * 참가에 감사드립니다.
 * ───────────────────────────────────────────
 * 버튼: [대회 상세보기] → https://mapo-tennis.com/tournaments/#{url}
 */
export async function sendTournamentApplyAlimtalk(
  params: TournamentApplyAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_TOURNAMENT_APPLY
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 대회 참가 신청 알림톡:', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.playerPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':   params.playerName,
          '#{대회명}':   params.tournamentName,
          '#{부서명}':   params.divisionName,
          '#{대회일시}': params.tournamentDate,
          '#{장소}':     params.venue,
          '#{url}':      params.tournamentId,
        },
      },
    })

    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 대회 참가 신청:', msg)
    return { success: false, error: msg }
  }
}

// ── 레슨 예약 알림 (코치 수신 — 신청 가능 레슨 없을 때 문의) ─────────────

export interface LessonReservationAlimtalkParams {
  coachPhone: string
  customerName: string
  customerPhone: string
  lessonStartDate: string
  lessonDays: string
}

/**
 * 레슨 예약 알림 발송 (코치 수신)
 * 발송 시점: /lessons 페이지에서 신청 가능 레슨 없을 때 문의 제출
 *
 * #{고객명}님이 레슨 예약하였습니다.
 * - 연락처: #{연락처}
 * - 레슨신청일: #{레슨시작일}
 * - 레슨요일: #{레슨요일}
 */
export async function sendLessonReservationAlimtalk(
  params: LessonReservationAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_LESSON_RESERVATION
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 레슨 예약 알림(코치):', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.coachPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':     params.customerName,
          '#{연락처}':     params.customerPhone,
          '#{레슨시작일}': params.lessonStartDate,
          '#{레슨요일}':   params.lessonDays,
        },
      },
    })
    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 레슨 예약 알림:', msg)
    return { success: false, error: msg }
  }
}

// ── 레슨 신청 알림 (코치 수신 — 실제 레슨 신청) ──────────────────────────

export interface LessonApplyToCoachAlimtalkParams {
  coachPhone: string
  customerName: string
  customerPhone: string
  lessonStartDate: string
  lessonDays: string
}

/**
 * 레슨 신청 알림 발송 (코치 수신)
 * 발송 시점: /lessons 페이지에서 실제 레슨 신청 완료
 *
 * #{고객명}님이 레슨 신청했습니다.
 * - 연락처: #{연락처}
 * - 레슨신청일: #{레슨시작일}
 * - 레슨요일: #{레슨요일}
 */
export async function sendLessonApplyToCoachAlimtalk(
  params: LessonApplyToCoachAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_LESSON_APPLY_COACH
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 레슨 신청 알림(코치):', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.coachPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':     params.customerName,
          '#{연락처}':     params.customerPhone,
          '#{레슨시작일}': params.lessonStartDate,
          '#{레슨요일}':   params.lessonDays,
        },
      },
    })
    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 레슨 신청 알림(코치):', msg)
    return { success: false, error: msg }
  }
}

// ── 레슨 확정 알림 (고객 수신) ────────────────────────────────────────────

export interface LessonConfirmAlimtalkParams {
  customerPhone: string
  customerName: string
  bankInfo: string
  lessonStartDate: string
  lessonInfo: string
  lessonDays: string
}

/**
 * 레슨 확정 알림 발송 (고객 수신)
 * 발송 시점: 코치/관리자가 수강 상태를 CONFIRMED로 변경
 *
 * #{고객명}님이 레슨 확정 되었습니다.
 * #{계좌정보}로 입금부탁드립니다.
 * - 레슨신청일: #{레슨시작일}
 * - 레슨정보: #{레슨정보}
 * - 레슨요일: #{레슨요일}
 */
export async function sendLessonConfirmAlimtalk(
  params: LessonConfirmAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_LESSON_CONFIRM
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 레슨 확정 알림(고객):', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.customerPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          '#{고객명}':   params.customerName,
          '#{계좌정보}': params.bankInfo,
          '#{레슨시작일}': params.lessonStartDate,
          '#{레슨정보}': params.lessonInfo,
          '#{레슨요일}': params.lessonDays,
        },
      },
    })
    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR] 레슨 확정 알림:', msg)
    return { success: false, error: msg }
  }
}

// ── 연장 신청 알림 ────────────────────────────────────────────────────────

export interface ExtensionAlimtalkParams {
  /** 코치 수신 전화번호 */
  coachPhone: string
  coachName: string
  memberName: string
  /** 예: "주중 2회 8회 패키지" */
  currentPackage: string
  requestedWeeks: number
  message: string
  adminUrl: string
}

/**
 * 연장 신청 알림톡 발송 (코치 수신)
 *
 * 알림톡 템플릿 예시 (솔라피 콘솔에서 승인):
 * ───────────────────────────────────────────
 * [테니스탭] 레슨 연장 신청
 *
 * #{coachName} 코치님,
 * #{memberName} 회원이 레슨 연장을 신청했습니다.
 *
 * · 현재 패키지: #{currentPackage}
 * · 연장 희망: #{requestedWeeks}주
 * · 메시지: #{message}
 *
 * 레슨 관리 페이지에서 확인해주세요.
 * ───────────────────────────────────────────
 */
export async function sendExtensionRequestAlimtalk(
  params: ExtensionAlimtalkParams,
): Promise<SendResult> {
  const service    = getService()
  const pfId       = process.env.SOLAPI_PFID
  const templateId = process.env.SOLAPI_TEMPLATE_EXTENSION_REQUEST
  const sender     = process.env.SOLAPI_SENDER_NUMBER

  // 개발 환경: 환경변수 미설정 시 mock 처리
  if (!service || !pfId || !templateId || !sender) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Alimtalk DEV] 연장 신청 알림톡:', params)
      return { success: true, messageId: 'DEV_MOCK' }
    }
    return { success: false, error: '솔라피 환경변수가 설정되지 않았습니다.' }
  }

  try {
    const result = await service.sendOne({
      to: params.coachPhone.replace(/-/g, ''),
      from: sender.replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        // 솔라피 알림톡 variables 키는 반드시 #{변수명} 형식이어야 함
        variables: {
          '#{coachName}':      params.coachName,
          '#{memberName}':     params.memberName,
          '#{currentPackage}': params.currentPackage,
          '#{requestedWeeks}': String(params.requestedWeeks),
          '#{message}':        params.message || '(메시지 없음)',
        },
      },
    })

    return { success: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알림톡 발송 오류'
    console.error('[Alimtalk ERROR]', msg)
    return { success: false, error: msg }
  }
}
