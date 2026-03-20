# Plan: Solapi 알림톡 설정

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 레슨 신청·대회 참가 확정 등 주요 이벤트 발생 시 사용자에게 즉각적인 알림 수단이 없어 운영자가 개별 연락해야 함 |
| **Solution** | 솔라피 카카오 알림톡 연동으로 이벤트 발생 시 자동 발송 — 운영자 개입 없이 실시간 알림 제공 |
| **Function UX Effect** | 레슨 신청 완료·대회 참가 확정·연장 신청 3종 알림톡 자동 발송, 가입환영 알림톡 추가 예정 |
| **Core Value** | 운영 효율 향상 + 사용자 신뢰도 제고 — 중요 이벤트를 카카오톡으로 즉시 확인 |

---

## 1. 배경 및 목표

### 1.1 현황
- 솔라피 연동 모듈(`src/lib/solapi/alimtalk.ts`) 구현 완료
- 레슨 신청 완료 / 대회 참가 확정 / 레슨 연장 신청 3종 발송 함수 구현
- 카카오 비즈니스 채널 연동 완료 (`후르랩`, PFID: `_UEcxhX`)
- `레슨 신청 결과 안내` 템플릿 승인 완료 (`KA01TP260318145412815lTEAbVDtzzp`)
- `마포구테니스협회 대회 참가 알림` 템플릿 검수 진행 중
- 가입환영 템플릿 미등록

### 1.2 목표
1. 검수 진행 중인 템플릿 승인 후 실제 발송 연결
2. 가입환영 알림톡 템플릿 등록 및 발송 함수 추가
3. 환경변수 정리 및 서버 배포 완료
4. 발송 성공/실패 로깅 체계 확인

---

## 2. 범위

### In Scope
- 솔라피 환경변수 서버 등록 (`SOLAPI_*`)
- 알림톡 발송 함수를 실제 Server Action에 연결
  - 레슨 신청 완료 → `sendLessonApplyAlimtalk`
  - 대회 참가 확정 → `sendTournamentConfirmAlimtalk`
  - 레슨 연장 신청 → `sendExtensionRequestAlimtalk`
- 가입환영 템플릿 솔라피 등록 + `sendWelcomeAlimtalk` 함수 추가
- 발송 실패 시 에러 로그 (서비스 중단 없이 fire-and-forget)

### Out of Scope
- 알림톡 발송 이력 DB 저장 (추후 별도 기능)
- 관리자 발송 통계 대시보드
- SMS 폴백 설정 (솔라피 기본 폴백 활용)

---

## 3. 알림톡 목록

| 템플릿명 | 발송 시점 | 수신자 | 상태 | 환경변수 |
|----------|-----------|--------|------|----------|
| 레슨 신청 결과 안내 | 레슨 신청 완료 시 | 고객 | ✅ 승인 | `SOLAPI_TEMPLATE_LESSON_APPLY` |
| 마포구테니스협회 대회 참가 알림 | 참가 확정 처리 시 | 참가자 | 🔄 검수 중 | `SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM` |
| 레슨 연장 신청 | 회원 연장 신청 시 | 코치 | 🔄 검수 중 | `SOLAPI_TEMPLATE_EXTENSION_REQUEST` |
| 가입환영 | 회원 가입 완료 시 | 신규 회원 | ❌ 미등록 | `SOLAPI_TEMPLATE_WELCOME` |

---

## 4. 구현 계획

### 4.1 환경변수 (Vercel 서버 등록 필요)
```
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_PFID=_UEcxhX
SOLAPI_SENDER_NUMBER=01085891858
SOLAPI_TEMPLATE_LESSON_APPLY=KA01TP260318145412815lTEAbVDtzzp
SOLAPI_TEMPLATE_TOURNAMENT_CONFIRM=   # 승인 후 등록
SOLAPI_TEMPLATE_EXTENSION_REQUEST=    # 승인 후 등록
SOLAPI_TEMPLATE_WELCOME=              # 등록 후 추가
```

### 4.2 발송 연결 대상 Server Actions

**레슨 신청 완료** (`src/lib/lessons/actions.ts`)
```ts
// 레슨 신청 처리 후
await sendLessonApplyAlimtalk({ phone, customerName, lessonName, ... })
```

**대회 참가 확정** (`src/lib/tournaments/actions.ts`)
```ts
// 참가 확정 처리 후
await sendTournamentConfirmAlimtalk({ playerPhone, playerName, tournamentName, ... })
```

**가입환영** (`src/lib/auth/actions.ts`)
```ts
// 회원가입 완료 후
await sendWelcomeAlimtalk({ phone, name })
```

### 4.3 발송 패턴 (fire-and-forget)
```ts
// 알림톡 발송 실패가 핵심 기능을 막으면 안 됨
const alimtalkResult = await sendXxxAlimtalk(params)
if (!alimtalkResult.success) {
  console.error('[Alimtalk] 발송 실패:', alimtalkResult.error)
  // 서비스 응답은 정상 처리
}
```

---

## 5. 가입환영 템플릿 본문 (안)

```
#{이름}님, 마포구테니스협회에 오신 것을 환영합니다! 🎾

협회 회원으로 등록되었습니다.
대회 참가, 클럽 가입, 레슨 신청 등 다양한 서비스를 이용하실 수 있습니다.

가입 사실이 없는 경우 관리자에게 문의해 주세요.
```

---

## 6. 체크리스트

- [ ] Vercel 환경변수 등록 (`SOLAPI_*` 전체)
- [ ] 레슨 신청 Server Action에 `sendLessonApplyAlimtalk` 연결
- [ ] 대회 참가 확정 Server Action에 `sendTournamentConfirmAlimtalk` 연결 (템플릿 승인 후)
- [ ] 가입환영 템플릿 솔라피 등록 및 심사 제출
- [ ] `sendWelcomeAlimtalk` 함수 추가
- [ ] 회원가입 Server Action에 `sendWelcomeAlimtalk` 연결
- [ ] 발송 테스트 스크립트(`scripts/test-alimtalk.ts`)로 전 템플릿 검증
