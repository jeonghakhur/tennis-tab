# Plan: 자연어 입력 액션 처리 (NLP Chat)

## 1. 개요

### 배경
Tennis Tab의 핵심 가치는 "자연어 기반 인터페이스"다. 현재 홈 화면(`src/app/page.tsx`)에 `ChatInput` 컴포넌트와 예시 프롬프트 UI가 구현되어 있고, DB에 `chat_logs` 테이블도 마이그레이션 완료 상태이나, 실제 API 연동이 없어 `console.log`만 찍히는 상태다(`// TODO: API 연동`).

### 목표
- **의도 분류(Intent Classification)**: 사용자 자연어 입력에서 의도를 파악 (대회 검색, 대진표 조회, 결과 조회 등)
- **엔티티 추출(Entity Extraction)**: 날짜, 지역, 대회명, 선수명 등 구조화된 정보 추출
- **액션 실행**: 파악된 의도에 따라 DB 조회/변경 실행 후 자연어 응답 반환
- **채팅 로그 저장**: `chat_logs` 테이블에 대화 기록 영구 저장
- **권한 기반 분기**: 비회원/회원/관리자별 사용 가능 Intent 분리

### 참고 문서
- PRD: `docs/PRD.md` 섹션 2 (자연어 처리 기능)

---

## 2. 범위

### Phase 1 (MVP) — 이번 구현
| 포함 | 제외 (Phase 2+) |
|------|----------------|
| Gemini 2.0 Flash 기반 Intent 분류 + Entity 추출 | 멀티턴 대화 (대화 이력 컨텍스트) |
| 비회원 Intent 4종: 대회 검색, 대진표 조회, 결과 조회, 참가 조건 조회 | 회원 전용 Intent: 참가 신청, 결과 등록, 참가 취소 |
| 도움말(HELP) Intent | 관리자 Intent: 대회 생성, 대진표 생성, 참가자 관리 |
| `/api/chat` Route Handler | 스트리밍 응답 (SSE) |
| `chat_logs` 저장 | 대화 세션 히스토리 UI |
| 홈 ChatInput ↔ API 연동 + 응답 표시 UI | 전용 채팅 페이지 (`/chat`) |
| 에러 핸들링 + Rate Limiting (기본) | 고급 Rate Limiting (Redis 기반) |

### Phase 2 (확장)
- 회원 전용 Intent: `JOIN_TOURNAMENT`, `CANCEL_ENTRY`, `REGISTER_RESULT`, `VIEW_MY_TOURNAMENTS`, `CHECK_ENTRY_STATUS`, `VIEW_MY_SCHEDULE`
- 관리자 Intent: `CREATE_TOURNAMENT`, `GENERATE_BRACKET`, `MANAGE_ENTRIES`, `UPDATE_TOURNAMENT`
- 멀티턴 대화 컨텍스트 (이전 대화 기반 후속 질문)
- 스트리밍 응답 (Server-Sent Events)
- 전용 채팅 페이지 + 대화 히스토리

---

## 3. 지원 Intent (Phase 1)

### 3.1 비회원 (로그인 불필요)

| Intent | 설명 | 예시 입력 |
|--------|------|----------|
| `SEARCH_TOURNAMENT` | 대회 검색 (날짜, 지역, 상태 필터) | "이번 주 서울에서 열리는 대회 알려줘" |
| `VIEW_BRACKET` | 대진표 조회 | "서울 오픈 대진표 보여줘" |
| `VIEW_RESULTS` | 경기 결과 조회 | "서울 오픈 결과 알려줘" |
| `VIEW_REQUIREMENTS` | 참가 기준/상세 조회 | "서울 오픈 참가 조건이 뭐야?" |
| `VIEW_AWARDS` | 수상자/입상 이력 조회 | "서울 오픈 우승자 누구야?", "김철수 수상 이력", "2024년 챌린저부 우승팀" |
| `HELP` | 서비스 안내 | "뭘 할 수 있어?", "도움말" |

### 3.2 Intent 분류 응답 스키마

```typescript
interface IntentClassification {
  intent: Intent
  entities: {
    tournament_name?: string   // "서울 오픈"
    location?: string          // "서울", "강남"
    date_range?: {
      start?: string           // ISO 8601
      end?: string
    }
    date_expression?: string   // "이번 주", "다음 토요일" (원본 표현)
    player_name?: string       // "김철수"
    status?: string            // "모집중", "진행중"
    year?: number              // 2024
    award_rank?: string        // "우승", "준우승", "3위", "공동3위"
    division?: string          // "챌린저부", "오픈부"
  }
  confidence: number           // 0.0 ~ 1.0
  requires_auth: boolean       // 로그인 필요 여부
}
```

---

## 4. 아키텍처

### 4.1 처리 파이프라인

```
[사용자 입력] → ChatInput (홈 페이지)
       ↓
[POST /api/chat] — Route Handler
       ↓
① 입력 검증 + sanitize
       ↓
② Gemini 2.0 Flash API 호출 (Intent 분류 + Entity 추출)
   - System Instruction: 도메인 컨텍스트 + Intent 목록 + JSON 출력 형식
   - User Input: 사용자 메시지
       ↓
③ JSON 응답 파싱 + 검증
       ↓
④ 권한 검증 (requires_auth Intent → 로그인 확인)
       ↓
⑤ Intent Handler 실행 (DB 조회/변경)
       ↓
⑥ 자연어 응답 생성 (Gemini 또는 템플릿)
       ↓
⑦ chat_logs INSERT (admin client)
       ↓
[JSON 응답 반환] → 프론트엔드 표시
```

### 4.2 디렉토리 구조

```
src/
├── app/
│   └── api/
│       └── chat/
│           └── route.ts           # POST Route Handler
├── lib/
│   └── chat/
│       ├── types.ts               # Intent, Entity, ChatResponse 타입
│       ├── classify.ts            # Gemini 2.0 Flash Intent 분류 + Entity 추출
│       ├── handlers/
│       │   ├── index.ts           # Intent → Handler 라우팅
│       │   ├── searchTournament.ts   # SEARCH_TOURNAMENT 핸들러
│       │   ├── viewBracket.ts        # VIEW_BRACKET 핸들러
│       │   ├── viewResults.ts        # VIEW_RESULTS 핸들러
│       │   ├── viewRequirements.ts   # VIEW_REQUIREMENTS 핸들러
│       │   ├── viewAwards.ts         # VIEW_AWARDS 핸들러
│       │   └── help.ts               # HELP 핸들러
│       ├── prompts.ts             # System Prompt 템플릿
│       ├── response.ts            # 자연어 응답 생성
│       └── logs.ts                # chat_logs 저장
└── components/
    └── chat/
        ├── ChatInput.tsx          # 기존 홈 ChatInput 분리 (리팩토링)
        └── ChatResponse.tsx       # 응답 표시 컴포넌트
```

### 4.3 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| LLM | **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) | Free Tier (1,500 RPD), 최저 비용 ($0.10/1M input), GA 안정 모델, Intent 분류에 충분한 성능 |
| SDK | `@google/genai` (Google Gen AI SDK) | 공식 Node.js SDK, TypeScript 지원, JSON mode 지원 |
| API 방식 | Route Handler (`/api/chat`) | Server Action보다 REST API가 적합 (외부 클라이언트 확장, Rate Limiting) |
| 응답 형식 | JSON (비스트리밍) | Phase 1 MVP 단순화. Phase 2에서 SSE 전환 |

### 4.4 Gemini 2.0 Flash 비용 분석

| Tier | Input | Output | RPM/RPD 제한 | 월 비용 |
|------|-------|--------|-------------|---------|
| **Free Tier** | $0 | $0 | 15 RPM, 1,500 RPD, 1M TPM | **$0** |
| Paid (Pay-as-you-go) | $0.10/1M tokens | $0.40/1M tokens | 2,000 RPM, 무제한 RPD | ~$4.20 (일 1,000건) |

> **Free Tier 활용 가능** — 일 1,500건까지 무료.
> 평균 요청당: ~600 input + ~200 output tokens
> Free Tier: 개발 + 초기 운영 완전 무료 (일 1,500건)
> Paid Tier: $0.10×0.6 + $0.40×0.2 = $0.00014/건 ≈ 월 $4.20 (일 1,000건)
>
> **비용 최적화 전략:**
> - Free Tier로 시작, 트래픽 증가 시 Paid 전환
> - HELP Intent는 LLM 미호출 (하드코딩 응답)
> - `max_output_tokens` 제한 (200~300)으로 output 비용 절감
> - 모델 업그레이드 필요 시 Gemini 2.0 Flash Lite ($0.025/$0.10) 다운그레이드 또는 Gemini 3 Pro 업그레이드 옵션

---

## 5. 핵심 구현 계획

### 5.1 Intent 분류 (`src/lib/chat/classify.ts`)

```typescript
// System Instruction으로 Gemini에 도메인 컨텍스트 전달
// JSON mode (responseMimeType: 'application/json')로 IntentClassification 반환
async function classifyIntent(
  message: string,
  userRole?: UserRole
): Promise<IntentClassification>
```

**System Instruction 전략**:
- 테니스 대회 플랫폼 도메인 설명
- 지원 Intent 목록 + 각 Intent 설명 + 예시
- 한국어 날짜 표현 → ISO 날짜 변환 규칙 ("이번 주" → 현재 주 월~일)
- JSON 출력 스키마 명시 (`responseSchema` 활용)
- Confidence threshold: 0.7 미만 시 `HELP`로 fallback

### 5.2 Intent Handlers

각 핸들러는 동일한 인터페이스를 따른다:

```typescript
interface HandlerResult {
  success: boolean
  data?: unknown              // 조회 결과 (대회 목록, 대진표 등)
  message: string             // 사용자에게 보여줄 자연어 응답
  links?: Array<{             // 관련 페이지 링크
    label: string
    href: string
  }>
}

type IntentHandler = (
  entities: IntentClassification['entities'],
  userId?: string
) => Promise<HandlerResult>
```

#### SEARCH_TOURNAMENT
- `tournaments` 테이블에서 `location`, `start_date`, `status` 기준 검색
- 날짜 표현 → 범위 변환: "이번 주" → 현재 주 월~일, "3월" → 3월 1일~31일
- 최대 5개 결과 반환 + 링크

#### VIEW_BRACKET
- `tournament_name`으로 대회 검색 (fuzzy match: ILIKE `%name%`)
- 대회 ID → `bracket_configs` → `bracket_matches` 조회
- 라운드별 매치 요약 반환 + 대진표 페이지 링크

#### VIEW_RESULTS
- 대회명으로 검색 → `bracket_matches` 중 `status='COMPLETED'` 필터
- 최근 결과 요약 (승자, 스코어) + 결과 페이지 링크

#### VIEW_REQUIREMENTS
- 대회명 검색 → `tournaments` + `divisions` 정보 조회
- 참가비, 최대 인원, 대회 형식, 일정 등 요약

#### VIEW_AWARDS
- `tournament_awards` 테이블 조회 (레거시 + 서비스 대회 통합)
- Entity 기반 필터 조합:
  - `tournament_name` → `competition ILIKE '%name%'`
  - `player_name` → GIN 인덱스 활용 (`players @> ARRAY[name]`)
  - `year` → `year = ?`
  - `award_rank` → `award_rank = ?` (우승/준우승/3위/공동3위)
  - `division` → `division ILIKE '%name%'`
- 필터 없이 조회 시 최근 연도 기준 최대 10건 반환
- 결과: 대회명, 연도, 부서, 순위, 선수명, 클럽명 + `/awards` 페이지 링크

#### HELP
- 사용 가능한 기능 목록 + 예시 프롬프트 반환
- 로그인 상태에 따라 추가 기능 안내

### 5.3 자연어 응답 생성 (`src/lib/chat/response.ts`)

**2단계 전략**:
1. **기본**: 핸들러가 반환한 `data`를 한국어 템플릿으로 포매팅
   - `검색 결과 {{count}}개의 대회를 찾았습니다:`
   - 각 대회: `📌 {{title}} — {{date}} / {{location}} ({{status}})`
2. **보강** (선택): 템플릿 결과를 Gemini에 한 번 더 전달하여 자연스러운 문체로 다듬기
   - Phase 1에서는 비용/속도를 위해 템플릿만 사용, Phase 2에서 LLM 보강 추가

### 5.4 채팅 로그 저장 (`src/lib/chat/logs.ts`)

```typescript
// admin client로 INSERT (RLS 우회)
async function saveChatLog(params: {
  userId?: string        // 비회원은 null
  sessionId?: string     // 세션 그룹핑
  message: string        // 사용자 입력
  response: string       // AI 응답
  intent: string         // 분류된 Intent
  entities: Record<string, unknown>  // 추출된 Entity
}): Promise<void>
```

### 5.5 프론트엔드 통합

#### ChatInput 리팩토링 (`src/components/chat/ChatInput.tsx`)
- `src/app/page.tsx`의 인라인 `ChatInput` → 별도 컴포넌트로 분리
- `onSubmit`에서 `POST /api/chat` 호출
- 로딩 상태, 에러 핸들링

#### ChatResponse (`src/components/chat/ChatResponse.tsx`)
- 응답 메시지 표시 (마크다운 스타일)
- 관련 링크 카드 (대회 상세, 대진표 등)
- 로딩 애니메이션 (타이핑 효과)
- 에러 상태 표시

#### 홈 페이지 레이아웃 변경
- ChatInput 아래에 ChatResponse 영역 추가
- 최근 1개 응답만 표시 (전용 채팅 페이지는 Phase 2)

---

## 6. API 설계

### POST `/api/chat`

**Request:**
```typescript
{
  message: string           // 사용자 입력 (필수, 1~500자)
  session_id?: string       // 세션 ID (선택)
}
```

**Response (성공):**
```typescript
{
  success: true
  intent: string            // 분류된 Intent
  message: string           // 자연어 응답
  data?: unknown            // 구조화된 결과 (대회 목록 등)
  links?: Array<{
    label: string
    href: string
  }>
}
```

**Response (에러):**
```typescript
{
  success: false
  error: string             // 에러 메시지
  code: 'RATE_LIMIT' | 'INVALID_INPUT' | 'AUTH_REQUIRED' | 'INTERNAL_ERROR'
}
```

**Rate Limiting:**
- 비회원: 10회/분
- 회원: 30회/분
- 인메모리 Map 기반 (Phase 1), Phase 2에서 Redis 전환

---

## 7. 구현 순서

| 단계 | 작업 | 예상 복잡도 |
|------|------|-----------|
| 1 | `@google/genai` 패키지 설치 + 환경변수 설정 | 낮음 |
| 2 | 타입 정의 (`src/lib/chat/types.ts`) | 낮음 |
| 3 | System Prompt 작성 (`src/lib/chat/prompts.ts`) | 중간 |
| 4 | Intent 분류 엔진 (`src/lib/chat/classify.ts`) | 높음 |
| 5 | Intent Handlers 구현 (6종) | 높음 |
| 6 | 자연어 응답 생성 (`src/lib/chat/response.ts`) | 중간 |
| 7 | 채팅 로그 저장 (`src/lib/chat/logs.ts`) | 낮음 |
| 8 | Route Handler (`/api/chat/route.ts`) + Rate Limiting | 중간 |
| 9 | ChatInput 분리 + ChatResponse 컴포넌트 | 중간 |
| 10 | 홈 페이지 통합 + E2E 테스트 | 중간 |

---

## 8. 기술적 고려사항

### 성능
- **Gemini 2.0 Flash 응답 시간**: 평균 0.5~2초 (Flash = 속도 최적화) → 프론트엔드에 로딩 애니메이션 필수
- **DB 조회 최적화**: 대회명 검색에 `pg_trgm` 확장 + GIN 인덱스 고려 (fuzzy match)
- **캐싱**: 동일 쿼리 단기 캐싱은 Phase 2 (chat_logs 기반)

### 비용
- Gemini 2.0 Flash: **Free Tier** 1,500 RPD / Paid $0.10/$0.40 per 1M tokens
- 개발~초기 운영: **$0** (Free Tier 내)
- 트래픽 증가 시: 일 1,000건 ≈ **월 ~$4.20** (GPT-4o-mini 대비 33% 저렴)
- **절감 전략**: HELP Intent LLM 미호출, `max_output_tokens` 제한

### 보안
- **입력 sanitize**: `sanitizeInput()` 적용 (XSS, injection 방지)
- **Prompt Injection 방어**: System Instruction에 역할 고정 + 출력 형식 강제
- **Rate Limiting**: IP 기반 + (회원은) userId 기반 이중 제한
- **API Key 보호**: `GEMINI_API_KEY` 서버 사이드만 접근, 클라이언트 노출 불가

### 에러 처리
- Gemini API 장애 시: "현재 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요."
- Intent confidence < 0.7: "죄송합니다, 정확히 이해하지 못했어요. 다시 말씀해 주시겠어요?"
- Rate Limit 초과: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요."

### 접근성 (WCAG 2.1 AA)
- ChatInput: `aria-label="메시지 입력"`, 키보드 제출(Enter)
- ChatResponse: `role="log"`, `aria-live="polite"` (새 응답 도착 시 스크린리더 알림)
- 로딩 상태: `aria-busy="true"` + 시각적 인디케이터

---

## 9. 환경변수

| 변수 | 용도 | Scope | 신규 |
|------|------|-------|:----:|
| `GEMINI_API_KEY` | Google Gemini 2.0 Flash API 인증 | Server | O |

> Google AI Studio (https://aistudio.google.com/) 에서 API 키 발급.
> Free Tier 사용 가능 (결제 설정 없이 시작 가능). `.env.local`에 설정.

---

## 10. 리스크 및 대응

| 리스크 | 영향 | 가능성 | 대응 |
|--------|------|--------|------|
| Gemini 2.0 Flash 응답 지연 (>5초) | 중간 | 낮음 | timeout 설정 (10초) + 사용자 피드백 UI |
| Prompt Injection 공격 | 높음 | 중간 | System Prompt 강화 + 출력 검증 + 입력 길이 제한(500자) |
| 대회명 fuzzy match 정확도 부족 | 중간 | 중간 | ILIKE → `pg_trgm` GIN 인덱스 + 유사도 threshold |
| Free Tier 초과 (일 1,500건+) | 낮음 | 낮음 | Free Tier → Paid 전환 (월 $4.20 수준), 일일 사용량 모니터링 |
| 한국어 날짜 표현 파싱 오류 | 낮음 | 중간 | GPT에 날짜 변환 위임 + 실패 시 전체 대회 검색 fallback |

---

## 11. 기존 인프라 활용

### 이미 구현된 것
- `chat_logs` 테이블 + RLS + 인덱스 (마이그레이션 `00_initial_schema.sql`)
- `ChatInput` UI (홈 페이지 `src/app/page.tsx` 인라인)
- 예시 프롬프트 4개 (대회 검색, 대진표, 결과, 참가 조건)
- `.env.example`에 `OPENAI_API_KEY` 문서화 (→ `GEMINI_API_KEY`로 교체)
- Supabase TypeScript 타입 (`src/lib/supabase/types.ts`에 `chat_logs` 포함)

### 활용할 기존 패턴
- `createAdminClient()`: chat_logs INSERT (RLS 우회)
- `sanitizeInput()`: 사용자 입력 검증 (`src/lib/utils/validation.ts`)
- Server Actions 패턴: 대회/대진표/엔트리 조회 로직 재사용
- `AlertDialog` / `Toast`: 에러/성공 피드백

---

## 12. 검증 기준

### 기능
- [ ] 홈 ChatInput에서 메시지 입력 → API 호출 → 응답 표시
- [ ] "이번 주 서울 대회" → `SEARCH_TOURNAMENT` → 대회 목록 반환
- [ ] "서울 오픈 대진표" → `VIEW_BRACKET` → 대진표 정보 + 링크 반환
- [ ] "서울 오픈 결과" → `VIEW_RESULTS` → 경기 결과 반환
- [ ] "참가 조건" → `VIEW_REQUIREMENTS` → 대회 상세 정보 반환
- [ ] "뭘 할 수 있어?" → `HELP` → 기능 안내 반환
- [ ] "서울 오픈 우승자 누구야?" → `VIEW_AWARDS` → 수상자 정보 반환
- [ ] "김철수 수상 이력" → `VIEW_AWARDS` → 해당 선수 입상 목록 반환
- [ ] "2024년 챌린저부 우승팀" → `VIEW_AWARDS` → 연도+부서+순위 필터 결과 반환
- [ ] 의미 없는 입력 → confidence 부족 → 재질문 안내
- [ ] `chat_logs`에 모든 대화 기록 저장

### 보안/성능
- [ ] Rate Limiting 동작 (비회원 10회/분, 회원 30회/분)
- [ ] 입력 500자 초과 시 에러 반환
- [ ] Gemini API 장애 시 사용자 친화적 에러 메시지
- [ ] `sanitizeInput()` 적용 확인

### 빌드
- [ ] TypeScript `tsc --noEmit` 통과
- [ ] `next build` 통과
