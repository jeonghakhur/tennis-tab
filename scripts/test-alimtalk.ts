/**
 * 알림톡 발송 테스트
 *
 * 실행:
 *   npx tsx scripts/test-alimtalk.ts
 *
 * 환경변수는 .env.local에서 자동 로드됩니다.
 */

import { SolapiMessageService } from 'solapi'

const apiKey    = process.env.SOLAPI_API_KEY
const apiSecret = process.env.SOLAPI_API_SECRET
const pfId      = process.env.SOLAPI_PFID
const sender    = process.env.SOLAPI_SENDER_NUMBER

if (!apiKey || !apiSecret || !pfId || !sender) {
  console.error('환경변수 누락:', { apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId, sender: !!sender })
  process.exit(1)
}

// ── 테스트 설정 ────────────────────────────────────────────────────────────

const TO_PHONE    = '01085891858'
const TEMPLATE_ID = 'KA01TP260318145412815lTEAbVDtzzp'

// ── 테스트 데이터 ──────────────────────────────────────────────────────────
const 고객명    = '홍길동'
const 레슨명    = '주중 테니스 레슨'
const 강사명    = '김코치'
const 레슨시작일 = '2026-04-01'
const 레슨정보  = '주 2회 / 8회 패키지'
const 레슨요일  = '월, 수'
const 장소      = '마포 테니스장'

// ──────────────────────────────────────────────────────────────────────────

async function main() {
  const service = new SolapiMessageService(apiKey!, apiSecret!)

  console.log('발송 시도...')
  console.log({ to: TO_PHONE, templateId: TEMPLATE_ID })

  const result = await service.sendOne({
    to:   TO_PHONE.replace(/-/g, ''),
    from: sender!.replace(/-/g, ''),
    kakaoOptions: {
      pfId: pfId!,
      templateId: TEMPLATE_ID,
      variables: {
        '#{고객명}':    고객명,
        '#{레슨명}':    레슨명,
        '#{강사명}':    강사명,
        '#{레슨시작일}': 레슨시작일,
        '#{레슨정보}':  레슨정보,
        '#{레슨요일}':  레슨요일,
        '#{장소}':      장소,
      },
    },
  })

  console.log('발송 성공:', result)
}

main().catch((err) => {
  console.error('발송 실패:', err?.message ?? err)
  process.exit(1)
})
