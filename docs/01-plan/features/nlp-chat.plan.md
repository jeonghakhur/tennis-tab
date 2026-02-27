# Plan: 자연어 입력 액션 처리 (NLP Chat)

> **최종 업데이트**: 2026-02-27
> 이 문서는 NLP 동작 룰 변경 시 반드시 업데이트한다.
> 구현 변경 전 이 문서를 먼저 확인하고, 변경 후 이력을 기록한다.

---

## 1. 개요

### 배경
Tennis Tab의 핵심 가치는 "자연어 기반 인터페이스"다. Gemini 2.0 Flash **Function Calling** 기반의 에이전트 루프로 구현되었으며, 사용자 자연어 입력 → 도구 호출 → DB 조회 → 자연어 응답 흐름으로 동작한다.

### 현재 구현 상태
- **방식**: Function Calling Agent (초기 설계의 Intent Classification 방식에서 전환됨)
- **핵심 파일**: `src/lib/chat/agent.ts`
- **라우트**: `POST /api/chat/route.ts` (인증) + `POST /api/chat/dev-test/route.ts` (DEV 전용)
- **지원 기능**: 대회 검색, 상세 조회, 내 신청 내역, 경기 일정/결과, 입상 기록, 참가 신청 플로우, 참가 취소 플로우

---

## 2. 현재 아키텍처

### 2.1 처리 파이프라인

```
[사용자 입력] → ChatInput (홈 페이지)
       ↓
[POST /api/chat] — Route Handler
       ↓
① 활성 플로우 세션 체크 (entryFlow / cancelFlow)
   - 세션 있으면 → handleEntryFlow / handleCancelFlow (Gemini 스킵)
       ↓
② Gemini 2.0 Flash Function Calling (최대 5 rounds)
   - System Prompt: 도메인 컨텍스트 + 도구 호출 규칙
   - Tool Declarations: 10개 도구
       ↓
③ Tool 실행 (DB 조회 / 플로우 시작)
       ↓
④ Tool 결과 → Gemini에 전달 → 자연어 응답 생성
       ↓
[JSON 응답 반환] → 프론트엔드 표시
```

### 2.2 디렉토리 구조 (현재)

```
src/lib/chat/
├── agent.ts                    # 핵심: Gemini Function Calling Agent 루프
├── types.ts                    # ChatMessage, AgentResult 등 타입
├── handlers/
│   ├── applyTournament.ts      # APPLY_TOURNAMENT 핸들러 (신청 플로우 진입)
│   └── index.ts
├── entryFlow/                  # 참가 신청 멀티스텝 플로우
│   ├── handler.ts              # 스텝별 처리 (SELECT_DIVISION, INPUT_PHONE, CONFIRM 등)
│   ├── sessionStore.ts         # 인메모리 세션 (TTL 10분)
│   ├── queries.ts              # DB 조회 함수
│   ├── steps.ts                # 파서 + 메시지 빌더
│   └── types.ts
└── cancelFlow/                 # 참가 취소 멀티스텝 플로우
    ├── handler.ts              # 스텝별 처리 (SELECT_ENTRY, CONFIRM_CANCEL)
    └── types.ts

src/app/api/chat/
├── route.ts                    # 프로덕션 엔드포인트 (Supabase 인증 필요)
└── dev-test/
    └── route.ts                # DEV 전용 (인증 없이 테스트, 프로덕션 404)
```

### 2.3 지원 도구 (Tool Declarations)

| 도구명 | 설명 | 파라미터 |
|--------|------|----------|
| `search_tournaments` | 대회 목록 검색 | location, status, date_start, date_end, max_fee, tournament_name |
| `get_tournament_detail` | 대회 상세 (참가비, 부서, 요강) | tournament_name (필수) |
| `get_my_entries` | 내 신청 내역 | status_filter (선택) |
| `get_bracket` | 대진표 조회 | tournament_name (필수) |
| `get_match_results` | 경기 결과 조회 | tournament_name (필수) |
| `get_my_schedule` | 내 다음 경기 일정 | 없음 |
| `get_my_results` | 내 경기 전적 | 없음 |
| `get_awards` | 입상 기록 조회 | tournament_name, player_name, year, scope |
| `initiate_apply_flow` | 참가 신청 플로우 시작 | tournament_name (선택) |
| `initiate_cancel_flow` | 참가 취소 플로우 시작 | 없음 |

---

## 3. NLP 동작 규칙 (System Prompt)

> **중요**: 룰 추가/수정 시 이 섹션을 업데이트하고 아래 이력에 기록한다.

### 3.1 언어 규칙
- 응답은 반드시 **한국어만** 사용. 러시아어·일본어·중국어 등 타 언어 절대 사용 금지
- 영어 상태값(`PENDING`, `APPROVED`, `REJECTED`, `CONFIRMED`, `WAITLISTED`, `UNPAID`, `COMPLETED` 등) 응답에 절대 노출 금지

### 3.2 즉시 도구 호출 규칙 (되묻지 말 것)

| 트리거 표현 | 호출 도구 | 파라미터 |
|------------|----------|----------|
| "대회 있어?", "대회 알려줘", "대회 있냐" | `search_tournaments` | 없음 (전체 조회) |
| "신청 가능한 대회", "모집 중인 대회", "지금 신청 가능", "접수 중인" | `search_tournaments` | status: "OPEN" |
| "진행 중인 대회", "현재 진행 중" | `search_tournaments` | status: "IN_PROGRESS" |
| "끝난 대회", "완료된 대회" | `search_tournaments` | status: "COMPLETED" |
| "신청하고 싶어", "신청할게", "대회 신청", "신청해줘", "신청하려고" | `initiate_apply_flow` | tournament_name (있으면) |
| "취소하고 싶어", "신청 취소", "취소할게", "참가 취소", "등록 취소" | `initiate_cancel_flow` | 없음 |
| "입상자", "입상 기록", "명예의 전당", "최근 우승자" | `get_awards` | 없음 (전체 조회) |
| "내가 신청한 대회", "내 신청 내역", "내가 참가 신청한" | `get_my_entries` | 없음 |
| "내 경기 일정", "다음 경기" | `get_my_schedule` | 없음 |
| "내 전적", "몇 승 몇 패" | `get_my_results` | 없음 |

### 3.3 응답 포맷 규칙
- 목록/지역/날짜 검색 → 대회명과 상태 위주로 간결하게
- "일정"을 묻는 경우 → 날짜와 장소 위주
- "상세/자세히/요강" 요청 → 참가비, 부서, 기타 정보 포함
- 도구 이름(`search_tournaments`, `initiate_apply_flow` 등) 응답 텍스트에 절대 노출 금지

### 3.4 날짜 표현 변환 기준 (현재 날짜 기준)
| 표현 | date_start / date_end |
|------|----------------------|
| 이번 주 | 이번 주 월~일 |
| 다음 달 | 다음 달 1일~말일 |
| 봄 | YYYY-03-01 ~ YYYY-05-31 |
| 여름 | YYYY-06-01 ~ YYYY-08-31 |
| 가을 | YYYY-09-01 ~ YYYY-11-30 |
| 겨울 | YYYY-12-01 ~ YYYY+1-02-28 |
| 상반기 | YYYY-01-01 ~ YYYY-06-30 |
| 하반기 | YYYY-07-01 ~ YYYY-12-31 |

---

## 4. 알려진 Gemini 동작 특성 및 대응

> Gemini 비결정적 동작으로 인한 버그 패턴과 해결법. 새 버그 발생 시 여기에 추가한다.

### 4.1 MALFORMED_FUNCTION_CALL
- **증상**: `finishReason=MALFORMED_FUNCTION_CALL, parts=0` — 응답이 아예 없음
- **원인 1**: Tool 선언에 `parameters: { type: OBJECT, properties: {} }` (빈 properties)
- **원인 2**: System prompt에 `tool_name({})` 표기 — Gemini가 빈 JSON 호출 시도
- **해결**: 파라미터 없는 도구는 `properties` 자체를 생략, 시스템 프롬프트에서 `({})` 제거

### 4.2 텍스트로 도구 호출 대체
- **증상**: "참가 신청을 시작합니다." 같은 텍스트를 반환하고 `initiate_apply_flow` 미호출
- **원인**: System prompt 룰만으로는 Gemini가 텍스트 응답으로 대체하는 경우 있음
- **해결**: Tool description에도 "텍스트 응답 절대 금지" 명시 (양쪽에 모두 제약)

### 4.3 영어 상태값 노출
- **증상**: "신청 상태는 PENDING, 결제 상태는 PENDING" 등 영어 원문 노출
- **원인**: Tool description에 영어 상태값이 있으면 Gemini가 그대로 복사
- **해결**: Tool description에서 영어 상태값 제거 + 한글 매핑 안내 + System prompt에 "영어 상태값 노출 금지" 룰

### 4.4 되묻기 (Clarification Seeking)
- **증상**: "어떤 상태의 신청 내역을 보시겠어요? (예: PENDING, APPROVED)" 등 재질문
- **원인**: 파라미터가 선택적인 도구는 Gemini가 사용자에게 확인하려는 경향
- **해결**: System prompt에 "파라미터 없이 호출 가능한 도구는 즉시 호출" + 도구 description에 "파라미터 없이 전체 조회 가능" 명시

### 4.6 플로우 세션이 새 질문을 가로채는 버그
- **증상**: 취소/신청 플로우 활성 중 "내가 참가 신청한 대회가 있어?" 입력 시 `"예" 또는 "아니오"로 답변해주세요.` 반환
- **원인**: route.ts가 세션 존재 여부만 보고 모든 메시지를 플로우로 라우팅
- **해결**: `isNewQueryDuringFlow(message, step)` 헬퍼로 판별. CONFIRM 스텝 → yes/no 외 새 질문, SELECT 스텝 → 숫자 외 새 질문 → 세션 삭제 후 에이전트로 fallthrough
- **위치**: `src/app/api/chat/route.ts`, `src/app/api/chat/dev-test/route.ts`

### 4.5 타 언어 Hallucination
- **증상**: "уточнить" (러시아어) 등 예상치 못한 언어가 응답에 포함
- **원인**: Gemini 다국어 학습 데이터에서 언어 혼합 발생
- **해결**: System prompt에 "응답은 한국어만 사용, 타 언어 절대 금지" 명시

---

## 5. 플로우 세션 (멀티스텝 인터랙션)

### 5.1 참가 신청 플로우 (entryFlow)

세션 TTL: 10분. Gemini를 거치지 않고 직접 처리.

```
[initiate_apply_flow] → 대회 검색 → 1개: SELECT_DIVISION / 복수: SELECT_TOURNAMENT
        ↓
SELECT_TOURNAMENT (번호 선택)
        ↓
SELECT_DIVISION (부서 번호 선택)
        ↓
INPUT_PHONE (전화번호)
        ↓ (경기 타입에 따라 분기)
INPUT_PARTNER (복식) / INPUT_CLUB_NAME → INPUT_TEAM_ORDER → INPUT_TEAM_MEMBERS (단체전)
        ↓
CONFIRM (예/아니오) → createEntry() 호출 → 완료
```

**중요**: `createEntry()`는 Supabase 세션 쿠키 필요 → entryFlow에서 직접 호출 불가.
현재 프로덕션 `route.ts`에서는 인증된 userId로 처리됨.

### 5.2 참가 취소 플로우 (cancelFlow)

세션 TTL: 10분. Gemini를 거치지 않고 직접 처리.

```
[initiate_cancel_flow] → fetchCancelableEntries(userId)
        ↓
1건: CONFIRM_CANCEL / 복수: SELECT_ENTRY (번호 선택)
        ↓
CONFIRM_CANCEL (예/아니오) → admin client로 직접 DELETE
        ↓
완료 (flow_active: false)
```

**중요**: 취소 실행 시 `deleteEntry()`(세션 쿠키 필요) 대신 admin client 직접 DELETE 사용.
fetchCancelableEntries에서 userId 검증 완료이므로 안전.

### 5.3 취소 키워드 (플로우 중단)

entryFlow: `['취소', 'cancel', '그만']`
cancelFlow: `['그만', 'cancel', '취소', '중단']`

---

## 6. 상태값 한글 매핑

### 참가 신청 상태 (EntryStatus)
| 영어 | 한글 |
|------|------|
| PENDING | 대기 |
| APPROVED | 승인 |
| REJECTED | 거절 |
| CONFIRMED | 확정 |
| WAITLISTED | 대기자 |
| CANCELLED | 취소 |

### 결제 상태 (PaymentStatus)
| 영어 | 한글 |
|------|------|
| UNPAID | 미납 |
| PENDING | 미납 |
| PAID | 완납 |
| COMPLETED | 완납 |
| FAILED | 실패 |
| CANCELLED | 취소 |

---

## 7. 테스트

### 테스트 스크립트
```bash
# 51개 케이스 통합 테스트 (dev 서버 실행 후)
node scripts/test-chat-agent.mjs
```

### 테스트 케이스 그룹
| 그룹 | 케이스 수 | 설명 |
|------|---------|------|
| 목록 | 5 | 대회 목록 다양한 표현 |
| 지역 | 4 | 지역명 검색 (한글 초성, 합성어 등) |
| 일정 | 6 | 날짜 표현 (이번 달, 다음 달, 봄/여름 등) |
| 상세 | 5 | 대회 상세 (참가비, 요강, 장소, 부서, 접수 기간) |
| 내 신청 | 5 | 내 신청 내역 조회 |
| 경기 | 5 | 경기 일정/결과/전적/대진표 |
| 입상 | 5 | 입상 기록 조회 |
| 신청/취소 | 3 | 참가 신청/취소 플로우 시작 |
| 복합 | 5 | 지역+날짜, 지역+상태 등 복합 조건 |
| 엣지 | 8 | 없는 지역/대회, 인사, 비로그인, 영어 질의, 오타 등 |

---

## 8. 변경 이력

> NLP 동작 규칙이나 시스템 프롬프트 변경 시 반드시 기록한다.

| 날짜 | 커밋 | 변경 내용 | 이유 |
|------|------|----------|------|
| 2026-02-27 | `510acc2` | MALFORMED_FUNCTION_CALL 수정: 빈 properties 제거, `({})` 표기 제거 | Gemini가 빈 JSON 생성 시도로 응답 실패 |
| 2026-02-27 | `9794093` | `get_my_entries` 즉시 호출 룰 추가, 영어 상태값 노출 금지 룰 추가 | "어떤 상태?" 되묻기 + PENDING 영문 노출 |
| 2026-02-27 | `7af8632` | cancelFlow PAYMENT_LABELS에 PENDING/COMPLETED/FAILED/CANCELLED 추가 | 결제 상태 "PENDING" 영문 그대로 노출 |
| 2026-02-27 | `4adf2da` | cancelFlow admin client 직접 삭제 전환, 취소 키워드 확장 | deleteEntry() 세션 쿠키 없어 "로그인 필요" 오류 |
| 2026-02-27 | `8bcd451` | 상태별 대회 조회 룰 추가 (OPEN/IN_PROGRESS/COMPLETED), 한국어 전용 룰 추가 | "신청 가능한 대회" 미인식 + 러시아어 hallucination |
| 2026-02-27 | `a86ee6e` | initiate_apply_flow tool desc 강화, 신청 키워드 확장 | Gemini가 "참가 신청을 시작합니다." 텍스트로 대체, tool 미호출 |
| 2026-02-27 | `6f3b6d0` | 플로우 세션 중 새 질문 감지 (`isNewQueryDuringFlow`) 추가 | 활성 세션이 새 질문을 "예/아니오" 스텝 입력으로 처리하는 버그 |
| 2026-02-27 | - | `UPCOMING` 상태 추가: STATUS_LABEL, 시스템 프롬프트 룰, tool description 업데이트 | DB에 UPCOMING 상태 추가 (접수 예정, 날짜 기반 자동 전환) |
| 2026-02-27 | - | 학습 데이터 사용 금지 룰 추가, temperature 0.4→0.1 하향 | 대회 상세 조회 시 인터넷/학습 데이터로 hallucination 발생 |
| 2026-02-27 | - | functionResponse를 JSON 객체로 전달 (JSON 문자열 래핑 제거) | Gemini가 문자열 응답 구조 파악 실패 → hallucination 근본 원인 |
| 2026-02-27 | - | toolGetTournamentDetail DRAFT/CANCELLED 노출 차단 | status 필터 없어 미공개 대회 정보 노출 가능 |
| 2026-02-27 | - | toolGetMyResults 전적 계산 버그 수정 (winner null → 패배 오카운트) | winner null인 경기도 패배로 카운트 |

---

## 9. 기술 스택

| 항목 | 선택 | 비고 |
|------|------|------|
| LLM | Google Gemini 2.0 Flash | `gemini-2.0-flash` |
| SDK | `@google/genai` v1.41.0 | Function Calling 지원 |
| 방식 | Function Calling Agent | 최대 5 rounds |
| 세션 | 인메모리 Map | entryFlow: TTL 30분, cancelFlow: TTL 10분 |
| 인증 | Supabase Server Client | route.ts에서 userId 추출 |

---

## 10. 환경변수

| 변수 | 용도 |
|------|------|
| `GEMINI_API_KEY` | Google Gemini 2.0 Flash API 인증 (서버 사이드 전용) |
