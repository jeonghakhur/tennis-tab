/**
 * 알림톡 발송 테스트 스크립트
 * 실행: node --env-file=.env.local scripts/test-alimtalk.mjs
 */

import { SolapiMessageService } from 'solapi'

const apiKey    = process.env.SOLAPI_API_KEY
const apiSecret = process.env.SOLAPI_API_SECRET
const pfId      = process.env.SOLAPI_PFID
const sender    = process.env.SOLAPI_SENDER_NUMBER
const templateId = process.env.SOLAPI_TEMPLATE_EXTENSION_REQUEST

// 환경변수 체크
const missing = []
if (!apiKey)     missing.push('SOLAPI_API_KEY')
if (!apiSecret)  missing.push('SOLAPI_API_SECRET')
if (!pfId)       missing.push('SOLAPI_PFID')
if (!sender)     missing.push('SOLAPI_SENDER_NUMBER')
if (!templateId) missing.push('SOLAPI_TEMPLATE_EXTENSION_REQUEST')

if (missing.length > 0) {
  console.error('❌ 누락된 환경변수:', missing.join(', '))
  process.exit(1)
}

console.log('📋 설정 확인:')
console.log('  API Key    :', apiKey.slice(0, 8) + '...')
console.log('  pfId       :', pfId)
console.log('  sender     :', sender)
console.log('  templateId :', templateId)
console.log()

const service = new SolapiMessageService(apiKey, apiSecret)

try {
  const result = await service.sendOne({
    to: '01085891858',
    from: sender.replace(/-/g, ''),
    kakaoOptions: {
      pfId,
      templateId,
      variables: {
        '#{coachName}':      '김코치',
        '#{memberName}':     '테스트회원',
        '#{currentPackage}': '주중 2회 8회 패키지',
        '#{requestedWeeks}': '4',
        '#{message}':        '테스트 발송입니다',
      },
    },
  })

  console.log('✅ 발송 성공!')
  console.log('  messageId:', result.messageId)
  console.log('  결과:', JSON.stringify(result, null, 2))
} catch (err) {
  console.error('❌ 발송 실패:', err.message)
  if (err.response?.data) {
    console.error('  API 에러:', JSON.stringify(err.response.data, null, 2))
  }
  process.exit(1)
}
