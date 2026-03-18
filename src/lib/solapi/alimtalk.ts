/**
 * 솔라피(Solapi) 카카오 알림톡 발송 모듈
 *
 * 필요 환경변수:
 *   SOLAPI_API_KEY       - 솔라피 API Key (콘솔 > 개발 정보 > API Key)
 *   SOLAPI_API_SECRET    - 솔라피 API Secret
 *   SOLAPI_PFID          - 카카오 채널 ID (@ 포함, 예: @tennistab)
 *   SOLAPI_SENDER_NUMBER - 등록된 발신번호 (010-xxxx-xxxx)
 *   SOLAPI_TEMPLATE_EXTENSION_REQUEST - 연장 신청 알림 템플릿 ID
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
