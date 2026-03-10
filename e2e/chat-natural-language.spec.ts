/**
 * 자연어 검색 (AI 챗봇) E2E 테스트 - 100개 시나리오
 *
 * 실행: npx playwright test e2e/chat-natural-language.spec.ts
 * 리포트: npx playwright show-report
 *
 * DEV 전용 엔드포인트 사용 (인증 불필요, NODE_ENV=development 환경)
 * 사용자 컨텍스트 테스트: E2E_TEST_USER_ID 환경변수 설정 권장
 */

import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// 헬퍼
// ============================================================================

/** E2E 테스트용 userId (설정 시 내 신청/일정 등 사용자 컨텍스트 활성화) */
const TEST_USER_ID = process.env.E2E_TEST_USER_ID ?? undefined

type ChatResult = {
  success: boolean
  message: string
  links?: { label: string; href: string }[]
  flow_active?: boolean
  intent?: string
}

/**
 * /api/chat/dev-test 호출 헬퍼
 * - 인증 불필요 (DEV 전용)
 * - user_id 지정 시 사용자 컨텍스트(신청 내역, 클럽 등) 활성화
 */
async function chat(
  page: Page,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  userId?: string
): Promise<ChatResult> {
  const res = await page.request.post('/api/chat/dev-test', {
    data: { message, history, user_id: userId ?? TEST_USER_ID },
  })
  expect(res.ok(), `HTTP ${res.status()}: ${message}`).toBe(true)
  return res.json()
}

/** 응답 기본 검증 */
function expectValid(result: ChatResult, context?: string) {
  expect(result.success, `success=false: ${context ?? ''}\n${result.message}`).toBe(true)
  expect(result.message, `빈 메시지: ${context ?? ''}`).toBeTruthy()
  expect(typeof result.message).toBe('string')
  expect(result.message.length, '응답이 너무 짧음').toBeGreaterThan(0)
}

// ============================================================================
// 1. 대회 검색 (25개)
// ============================================================================

test.describe('🏆 대회 검색', () => {
  test('01 - 이번 주 서울 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '이번 주 서울 대회 알려줘')
    expectValid(r)
  })

  test('02 - 마포구 대회 뭐 있어?', async ({ page }) => {
    const r = await chat(page, '마포구 대회 뭐 있어?')
    expectValid(r)
  })

  test('03 - 다음 달 테니스 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '다음 달 테니스 대회 알려줘')
    expectValid(r)
  })

  test('04 - 지금 모집 중인 대회 보여줘', async ({ page }) => {
    const r = await chat(page, '지금 모집 중인 대회 보여줘')
    expectValid(r)
  })

  test('05 - 지금 진행 중인 대회 있어?', async ({ page }) => {
    const r = await chat(page, '지금 진행 중인 대회 있어?')
    expectValid(r)
  })

  test('06 - 서울 지역 대회 검색해줘', async ({ page }) => {
    const r = await chat(page, '서울 지역 대회 검색해줘')
    expectValid(r)
  })

  test('07 - 참가비 싼 대회 있어?', async ({ page }) => {
    const r = await chat(page, '참가비 싼 대회 있어?')
    expectValid(r)
  })

  test('08 - 구청장기 대회 있어?', async ({ page }) => {
    const r = await chat(page, '구청장기 대회 있어?')
    expectValid(r)
  })

  test('09 - 테니스 동호인 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '테니스 동호인 대회 알려줘')
    expectValid(r)
  })

  test('10 - 6월에 대회 있나요?', async ({ page }) => {
    const r = await chat(page, '6월에 대회 있나요?')
    expectValid(r)
  })

  test('11 - 무료 대회 있어?', async ({ page }) => {
    const r = await chat(page, '무료 대회 있어?')
    expectValid(r)
  })

  test('12 - 대회 목록 보여줘', async ({ page }) => {
    const r = await chat(page, '대회 목록 보여줘')
    expectValid(r)
  })

  test('13 - 이번 달 예정된 대회 있어?', async ({ page }) => {
    const r = await chat(page, '이번 달 예정된 대회 있어?')
    expectValid(r)
  })

  test('14 - 강남구 대회 찾아줘', async ({ page }) => {
    const r = await chat(page, '강남구 대회 찾아줘')
    expectValid(r)
  })

  test('15 - 마포구청장기 대회 언제야?', async ({ page }) => {
    const r = await chat(page, '마포구청장기 대회 언제야?')
    expectValid(r)
  })

  test('16 - 지금 신청 가능한 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '지금 신청 가능한 대회 알려줘')
    expectValid(r)
  })

  test('17 - 이번 주말 대회 있어?', async ({ page }) => {
    const r = await chat(page, '이번 주말 대회 있어?')
    expectValid(r)
  })

  test('18 - 마감임박한 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '마감임박한 대회 알려줘')
    expectValid(r)
  })

  test('19 - 복식 대회 있어?', async ({ page }) => {
    const r = await chat(page, '복식 대회 있어?')
    expectValid(r)
  })

  test('20 - 혼합복식 대회 찾아줘', async ({ page }) => {
    const r = await chat(page, '혼합복식 대회 찾아줘')
    expectValid(r)
  })

  test('21 - 한 달 안에 있는 대회 알려줘', async ({ page }) => {
    const r = await chat(page, '한 달 안에 있는 대회 알려줘')
    expectValid(r)
  })

  test('22 - 회장기 대회 있어?', async ({ page }) => {
    const r = await chat(page, '회장기 대회 있어?')
    expectValid(r)
  })

  test('23 - 구협회장기 대회 어디서 열려?', async ({ page }) => {
    const r = await chat(page, '구협회장기 대회 어디서 열려?')
    expectValid(r)
  })

  test('24 - 대회 신청 접수 기간 얼마나 남았어?', async ({ page }) => {
    const r = await chat(page, '대회 신청 접수 기간 얼마나 남았어?')
    expectValid(r)
  })

  test('25 - 앞으로 있는 대회 일정 전부 알려줘', async ({ page }) => {
    const r = await chat(page, '앞으로 있는 대회 일정 전부 알려줘')
    expectValid(r)
  })
})

// ============================================================================
// 2. 내 신청 내역 (10개)
// ============================================================================

test.describe('📋 내 신청 내역', () => {
  test('26 - 내가 신청한 대회 보여줘', async ({ page }) => {
    const r = await chat(page, '내가 신청한 대회 보여줘')
    expectValid(r)
    // 내 신청 관련 응답이면 링크가 있을 수 있음
    if (r.links?.length) {
      expect(r.links[0].href).toBeTruthy()
    }
  })

  test('27 - 내 신청 목록 알려줘', async ({ page }) => {
    const r = await chat(page, '내 신청 목록 알려줘')
    expectValid(r)
  })

  test('28 - 내 참가 현황 알려줘', async ({ page }) => {
    const r = await chat(page, '내 참가 현황 알려줘')
    expectValid(r)
  })

  test('29 - 결제 완료된 내 신청 있어?', async ({ page }) => {
    const r = await chat(page, '결제 완료된 내 신청 있어?')
    expectValid(r)
  })

  test('30 - 내 신청 취소된 것 있어?', async ({ page }) => {
    const r = await chat(page, '내 신청 취소된 것 있어?')
    expectValid(r)
  })

  test('31 - 신청 확정된 대회 보여줘', async ({ page }) => {
    const r = await chat(page, '신청 확정된 대회 보여줘')
    expectValid(r)
  })

  test('32 - 내가 등록한 대회 목록', async ({ page }) => {
    const r = await chat(page, '내가 등록한 대회 목록')
    expectValid(r)
  })

  test('33 - 최근에 신청한 대회 뭐야?', async ({ page }) => {
    const r = await chat(page, '최근에 신청한 대회 뭐야?')
    expectValid(r)
  })

  test('34 - 내 참가 내역 전체 보여줘', async ({ page }) => {
    const r = await chat(page, '내 참가 내역 전체 보여줘')
    expectValid(r)
  })

  test('35 - 결제 안 한 신청 있어?', async ({ page }) => {
    const r = await chat(page, '결제 안 한 신청 있어?')
    expectValid(r)
  })
})

// ============================================================================
// 3. 대진표 조회 (10개)
// ============================================================================

test.describe('🎯 대진표 조회', () => {
  test('36 - 대진표 보고 싶어', async ({ page }) => {
    const r = await chat(page, '대진표 보고 싶어')
    expectValid(r)
  })

  test('37 - 지금 진행 중인 대회 대진표 보여줘', async ({ page }) => {
    const r = await chat(page, '지금 진행 중인 대회 대진표 보여줘')
    expectValid(r)
    // 대진표 링크가 있으면 bracket 경로여야 함
    const bracketLink = r.links?.find((l) => l.href.includes('bracket'))
    if (bracketLink) {
      expect(bracketLink.href).toMatch(/\/tournaments\/[^/]+\/bracket/)
    }
  })

  test('38 - 구협회장기 대진표 있어?', async ({ page }) => {
    const r = await chat(page, '구협회장기 대진표 있어?')
    expectValid(r)
  })

  test('39 - 내 다음 경기 누구야?', async ({ page }) => {
    const r = await chat(page, '내 다음 경기 누구야?')
    expectValid(r)
  })

  test('40 - 16강 대진 알려줘', async ({ page }) => {
    const r = await chat(page, '16강 대진 알려줘')
    expectValid(r)
  })

  test('41 - 8강 대진표 보고 싶어', async ({ page }) => {
    const r = await chat(page, '8강 대진표 보고 싶어')
    expectValid(r)
  })

  test('42 - 오늘 경기 대진 알려줘', async ({ page }) => {
    const r = await chat(page, '오늘 경기 대진 알려줘')
    expectValid(r)
  })

  test('43 - 결승 누구랑 누구야?', async ({ page }) => {
    const r = await chat(page, '결승 누구랑 누구야?')
    expectValid(r)
  })

  test('44 - 내 경기 일정 알려줘', async ({ page }) => {
    const r = await chat(page, '내 경기 일정 알려줘')
    expectValid(r)
  })

  test('45 - 마포구청장기 대진표 어떻게 됐어?', async ({ page }) => {
    const r = await chat(page, '마포구청장기 대진표 어떻게 됐어?')
    expectValid(r)
  })
})

// ============================================================================
// 4. 경기 결과 (10개)
// ============================================================================

test.describe('🏅 경기 결과', () => {
  test('46 - 최근 경기 결과 알려줘', async ({ page }) => {
    const r = await chat(page, '최근 경기 결과 알려줘')
    expectValid(r)
  })

  test('47 - 마포구청장기 결과 어떻게 됐어?', async ({ page }) => {
    const r = await chat(page, '마포구청장기 결과 어떻게 됐어?')
    expectValid(r)
  })

  test('48 - 어제 경기 결과 뭐야?', async ({ page }) => {
    const r = await chat(page, '어제 경기 결과 뭐야?')
    expectValid(r)
  })

  test('49 - 경기 점수 어떻게 됐어?', async ({ page }) => {
    const r = await chat(page, '경기 점수 어떻게 됐어?')
    expectValid(r)
  })

  test('50 - 우승자 누가 됐어?', async ({ page }) => {
    const r = await chat(page, '우승자 누가 됐어?')
    expectValid(r)
  })

  test('51 - 결승 결과 알려줘', async ({ page }) => {
    const r = await chat(page, '결승 결과 알려줘')
    expectValid(r)
  })

  test('52 - 준결승 결과 보여줘', async ({ page }) => {
    const r = await chat(page, '준결승 결과 보여줘')
    expectValid(r)
  })

  test('53 - 내 경기 결과 알려줘', async ({ page }) => {
    const r = await chat(page, '내 경기 결과 알려줘')
    expectValid(r)
  })

  test('54 - 대회 최종 결과 뭐야?', async ({ page }) => {
    const r = await chat(page, '대회 최종 결과 뭐야?')
    expectValid(r)
  })

  test('55 - 내 테니스 전적 알려줘', async ({ page }) => {
    const r = await chat(page, '내 테니스 전적 알려줘')
    expectValid(r)
  })
})

// ============================================================================
// 5. 참가 조건 (10개)
// ============================================================================

test.describe('📝 참가 조건', () => {
  test('56 - 마포구청장기 참가 조건이 뭐야?', async ({ page }) => {
    const r = await chat(page, '마포구청장기 참가 조건이 뭐야?')
    expectValid(r)
  })

  test('57 - 이 대회 참가비 얼마야?', async ({ page }) => {
    const r = await chat(page, '이 대회 참가비 얼마야?')
    expectValid(r)
  })

  test('58 - 참가 자격 어떻게 돼?', async ({ page }) => {
    const r = await chat(page, '참가 자격 어떻게 돼?')
    expectValid(r)
  })

  test('59 - 연령 제한 있어?', async ({ page }) => {
    const r = await chat(page, '연령 제한 있어?')
    expectValid(r)
  })

  test('60 - 복식 파트너 조건 있어?', async ({ page }) => {
    const r = await chat(page, '복식 파트너 조건 있어?')
    expectValid(r)
  })

  test('61 - 단식 참가 기준 알려줘', async ({ page }) => {
    const r = await chat(page, '단식 참가 기준 알려줘')
    expectValid(r)
  })

  test('62 - 대회 요강 보여줘', async ({ page }) => {
    const r = await chat(page, '대회 요강 보여줘')
    expectValid(r)
  })

  test('63 - 초보자도 참가 가능해?', async ({ page }) => {
    const r = await chat(page, '초보자도 참가 가능해?')
    expectValid(r)
  })

  test('64 - 부서별 참가 조건 알려줘', async ({ page }) => {
    const r = await chat(page, '부서별 참가 조건 알려줘')
    expectValid(r)
  })

  test('65 - 테니스 선수 등록 필요해?', async ({ page }) => {
    const r = await chat(page, '테니스 선수 등록 필요해?')
    expectValid(r)
  })
})

// ============================================================================
// 6. 참가 신청 (10개)
// ============================================================================

test.describe('✍️ 참가 신청', () => {
  test('66 - 대회 참가 신청하고 싶어', async ({ page }) => {
    const r = await chat(page, '대회 참가 신청하고 싶어')
    expectValid(r)
  })

  test('67 - 신청하고 싶은데 어떻게 해?', async ({ page }) => {
    const r = await chat(page, '신청하고 싶은데 어떻게 해?')
    expectValid(r)
  })

  test('68 - 마포구청장기 참가 신청할게', async ({ page }) => {
    const r = await chat(page, '마포구청장기 참가 신청할게')
    expectValid(r)
  })

  test('69 - 대회 등록하고 싶어', async ({ page }) => {
    const r = await chat(page, '대회 등록하고 싶어')
    expectValid(r)
  })

  test('70 - 대회 신청 방법 알려줘', async ({ page }) => {
    const r = await chat(page, '대회 신청 방법 알려줘')
    expectValid(r)
  })

  test('71 - 지금 바로 신청할 수 있어?', async ({ page }) => {
    const r = await chat(page, '지금 바로 신청할 수 있어?')
    expectValid(r)
  })

  test('72 - 대회 신청 시작해줘', async ({ page }) => {
    const r = await chat(page, '대회 신청 시작해줘')
    expectValid(r)
  })

  test('73 - 신청하려다 그만할래', async ({ page }) => {
    // 신청 플로우 진입 후 취소 의향 표시
    const r = await chat(page, '신청하려다 그만할래')
    expectValid(r)
  })

  test('74 - 참가비 어떻게 내?', async ({ page }) => {
    const r = await chat(page, '참가비 어떻게 내?')
    expectValid(r)
  })

  test('75 - 이미 마감된 대회 신청 가능해?', async ({ page }) => {
    const r = await chat(page, '이미 마감된 대회 신청 가능해?')
    expectValid(r)
  })
})

// ============================================================================
// 7. 참가 취소 (5개)
// ============================================================================

test.describe('❌ 참가 취소', () => {
  test('76 - 신청 취소하고 싶어', async ({ page }) => {
    const r = await chat(page, '신청 취소하고 싶어')
    expectValid(r)
  })

  test('77 - 대회 등록 취소해줘', async ({ page }) => {
    const r = await chat(page, '대회 등록 취소해줘')
    expectValid(r)
  })

  test('78 - 참가 취소하려면 어떻게 해?', async ({ page }) => {
    const r = await chat(page, '참가 취소하려면 어떻게 해?')
    expectValid(r)
  })

  test('79 - 내 신청 취소 가능해?', async ({ page }) => {
    const r = await chat(page, '내 신청 취소 가능해?')
    expectValid(r)
  })

  test('80 - 대회 취소하면 참가비 환불 돼?', async ({ page }) => {
    const r = await chat(page, '대회 취소하면 참가비 환불 돼?')
    expectValid(r)
  })
})

// ============================================================================
// 8. 입상 / 수상 기록 (5개)
// ============================================================================

test.describe('🥇 입상 기록', () => {
  test('81 - 입상 기록 보여줘', async ({ page }) => {
    const r = await chat(page, '입상 기록 보여줘')
    expectValid(r)
  })

  test('82 - 우승자 명단 알려줘', async ({ page }) => {
    const r = await chat(page, '우승자 명단 알려줘')
    expectValid(r)
  })

  test('83 - 명예의 전당 보여줘', async ({ page }) => {
    const r = await chat(page, '명예의 전당 보여줘')
    expectValid(r)
  })

  test('84 - 작년 우승자 누구야?', async ({ page }) => {
    const r = await chat(page, '작년 우승자 누구야?')
    expectValid(r)
  })

  test('85 - 역대 우승 기록 알려줘', async ({ page }) => {
    const r = await chat(page, '역대 우승 기록 알려줘')
    expectValid(r)
  })
})

// ============================================================================
// 9. 클럽 조회 (5개)
// ============================================================================

test.describe('🎾 클럽 조회', () => {
  test('86 - 우리 클럽 모임 일정 알려줘', async ({ page }) => {
    const r = await chat(page, '우리 클럽 모임 일정 알려줘')
    expectValid(r)
  })

  test('87 - 이번 주 클럽 모임 있어?', async ({ page }) => {
    const r = await chat(page, '이번 주 클럽 모임 있어?')
    expectValid(r)
  })

  test('88 - 클럽 순위 보여줘', async ({ page }) => {
    const r = await chat(page, '클럽 순위 보여줘')
    expectValid(r)
  })

  test('89 - 테니스 클럽 랭킹 알려줘', async ({ page }) => {
    const r = await chat(page, '테니스 클럽 랭킹 알려줘')
    expectValid(r)
  })

  test('90 - 클럽 모임 언제야?', async ({ page }) => {
    const r = await chat(page, '클럽 모임 언제야?')
    expectValid(r)
  })
})

// ============================================================================
// 10. 도움말 / 일반 (5개)
// ============================================================================

test.describe('💬 도움말 / 일반', () => {
  test('91 - 뭘 도와줄 수 있어?', async ({ page }) => {
    const r = await chat(page, '뭘 도와줄 수 있어?')
    expectValid(r)
    expect(r.message.length).toBeGreaterThan(20) // 도움말은 충분히 길어야 함
  })

  test('92 - 어떤 기능이 있어?', async ({ page }) => {
    const r = await chat(page, '어떤 기능이 있어?')
    expectValid(r)
  })

  test('93 - 사용법 알려줘', async ({ page }) => {
    const r = await chat(page, '사용법 알려줘')
    expectValid(r)
  })

  test('94 - 테니스 대회 관련 질문 가능해?', async ({ page }) => {
    const r = await chat(page, '테니스 대회 관련해서 뭐 물어볼 수 있어?')
    expectValid(r)
  })

  test('95 - 인사', async ({ page }) => {
    const r = await chat(page, '안녕')
    expectValid(r)
  })
})

// ============================================================================
// 11. 다회전 대화 (컨텍스트 유지) (5개)
// ============================================================================

test.describe('🔄 다회전 대화', () => {
  test('96 - 대회 검색 후 상세 질문', async ({ page }) => {
    const first = await chat(page, '모집 중인 대회 보여줘')
    expectValid(first)

    // 이전 대화를 히스토리로 전달
    const second = await chat(
      page,
      '그 대회 참가비 얼마야?',
      [
        { role: 'user', content: '모집 중인 대회 보여줘' },
        { role: 'assistant', content: first.message },
      ]
    )
    expectValid(second)
  })

  test('97 - 대진표 조회 후 결과 질문', async ({ page }) => {
    const first = await chat(page, '진행 중인 대회 대진표 보여줘')
    expectValid(first)

    const second = await chat(
      page,
      '그 대회 최근 경기 결과는?',
      [
        { role: 'user', content: '진행 중인 대회 대진표 보여줘' },
        { role: 'assistant', content: first.message },
      ]
    )
    expectValid(second)
  })

  test('98 - 신청 플로우 진입 후 취소', async ({ page }) => {
    const first = await chat(page, '대회 신청하고 싶어')
    expectValid(first)

    const second = await chat(
      page,
      '취소',
      [
        { role: 'user', content: '대회 신청하고 싶어' },
        { role: 'assistant', content: first.message },
      ]
    )
    expectValid(second)
    // 취소 후 플로우가 비활성화되거나 안내 메시지가 나와야 함
  })

  test('99 - 맥락 없는 숫자 입력 (무의미)', async ({ page }) => {
    const r = await chat(page, '1234567890')
    expectValid(r)
    // 무의미한 입력에도 500 에러 없이 응답
  })

  test('100 - 한글 무의미 입력', async ({ page }) => {
    const r = await chat(page, '가나다라마바사아자차카타파하')
    expectValid(r)
    // graceful degradation: 이해 못 해도 도움말 제공
  })
})

// ============================================================================
// 12. UI 통합 테스트 - FloatingChat (UI 렌더링 검증)
// ============================================================================

test.describe('🖥️ FloatingChat UI', () => {
  test('홈 페이지에 FloatingChat 버튼이 표시됨', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // fixed 위치의 원형 버튼 (우측 하단)
    const floatBtn = page.locator('button.rounded-full').last()
    await expect(floatBtn).toBeVisible({ timeout: 5_000 })
  })

  test('FloatingChat 클릭 시 채팅 다이얼로그가 열림', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const floatBtn = page.getByRole('button', { name: 'AI 어시스턴트 열기' })
    await expect(floatBtn).toBeVisible({ timeout: 5_000 })
    await floatBtn.click()

    // 다이얼로그(role=dialog)가 나타나야 함
    const dialog = page.getByRole('dialog', { name: 'AI 어시스턴트' })
    await expect(dialog).toBeVisible({ timeout: 3_000 })
  })

  test('채팅창 ESC 키로 닫힘', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const floatBtn = page.getByRole('button', { name: 'AI 어시스턴트 열기' })
    await expect(floatBtn).toBeVisible({ timeout: 5_000 })
    await floatBtn.click()

    const dialog = page.getByRole('dialog', { name: 'AI 어시스턴트' })
    await expect(dialog).toBeVisible({ timeout: 3_000 })

    await page.keyboard.press('Escape')
    // 닫힌 후 다이얼로그가 사라져야 함 (hidden 클래스로 숨겨짐)
    await expect(dialog).toBeHidden({ timeout: 2_000 })
  })

  test('비로그인 시 로그인 유도 메시지 표시', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const floatBtn = page.getByRole('button', { name: 'AI 어시스턴트 열기' })
    await expect(floatBtn).toBeVisible({ timeout: 5_000 })
    await floatBtn.click()

    // 비로그인 상태 → 다이얼로그 내 로그인 유도 배너 표시
    const dialog = page.getByRole('dialog', { name: 'AI 어시스턴트' })
    await expect(dialog.getByText(/로그인이 필요/).first()).toBeVisible({ timeout: 3_000 })
    await expect(dialog.getByRole('link', { name: '로그인하기' }).first()).toBeVisible()
  })

  test('닫기 버튼으로 채팅창 닫힘', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const floatBtn = page.getByRole('button', { name: 'AI 어시스턴트 열기' })
    await expect(floatBtn).toBeVisible({ timeout: 5_000 })
    await floatBtn.click()

    const dialog = page.getByRole('dialog', { name: 'AI 어시스턴트' })
    await expect(dialog).toBeVisible({ timeout: 3_000 })

    // X 버튼 클릭
    await page.getByRole('button', { name: '닫기' }).click()
    await expect(dialog).toBeHidden({ timeout: 2_000 })
  })
})
