# Design: 자연어 입력 액션 처리 (NLP Chat)

> Plan: `docs/01-plan/features/nlp-chat.plan.md`

---

## 1. 패키지 설치

```bash
yarn add @google/genai
```

환경변수 추가 (`.env.local`):

```
GEMINI_API_KEY=your_api_key_here
```

> Google AI Studio (https://aistudio.google.com/) 에서 발급. Free Tier로 시작.

---

## 2. 타입 정의

### 파일: `src/lib/chat/types.ts`

```typescript
/** Phase 1 지원 Intent */
export type Intent =
  | 'SEARCH_TOURNAMENT'
  | 'VIEW_BRACKET'
  | 'VIEW_RESULTS'
  | 'VIEW_REQUIREMENTS'
  | 'HELP'

/** Gemini가 반환하는 Intent 분류 결과 */
export interface IntentClassification {
  intent: Intent
  entities: ChatEntities
  confidence: number        // 0.0 ~ 1.0
  requires_auth: boolean
}

/** 추출된 엔티티 */
export interface ChatEntities {
  tournament_name?: string
  location?: string
  date_range?: {
    start?: string           // ISO 8601 (YYYY-MM-DD)
    end?: string
  }
  date_expression?: string   // 원본 표현: "이번 주", "3월"
  player_name?: string
  status?: string            // "모집중", "진행중"
}

/** Intent Handler가 반환하는 결과 */
export interface HandlerResult {
  success: boolean
  data?: unknown
  message: string
  links?: Array<{
    label: string
    href: string
  }>
}

/** POST /api/chat 요청 */
export interface ChatRequest {
  message: string            // 1~500자
  session_id?: string
}

/** POST /api/chat 성공 응답 */
export interface ChatSuccessResponse {
  success: true
  intent: Intent
  message: string
  data?: unknown
  links?: Array<{
    label: string
    href: string
  }>
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
```

---

## 3. System Prompt

### 파일: `src/lib/chat/prompts.ts`

```typescript
/** 현재 날짜 정보를 포함한 System Instruction 생성 */
export function buildSystemPrompt(): string
```

**프롬프트 구조:**

```
[역할 정의]
당신은 테니스 대회 관리 플랫폼 "Tennis Tab"의 AI 어시스턴트입니다.
사용자의 자연어 질문을 분석하여 의도(intent)를 분류하고, 관련 엔티티를 추출합니다.

[현재 날짜]
오늘 날짜: {YYYY-MM-DD} ({요일})

[지원 Intent 목록]
1. SEARCH_TOURNAMENT: 대회 검색 (날짜, 지역, 상태)
   예시: "이번 주 서울 대회", "3월 대회 알려줘", "모집중인 대회"
2. VIEW_BRACKET: 대진표 조회
   예시: "서울 오픈 대진표", "대진표 보여줘"
3. VIEW_RESULTS: 경기 결과 조회
   예시: "서울 오픈 결과", "누가 이겼어?"
4. VIEW_REQUIREMENTS: 참가 조건/상세 조회
   예시: "참가 조건", "참가비 얼마야?"
5. HELP: 도움말/기능 안내
   예시: "뭘 할 수 있어?", "도움말"

[날짜 변환 규칙]
- "이번 주" → 현재 주 월요일 ~ 일요일
- "다음 주" → 다음 주 월요일 ~ 일요일
- "이번 달" / "3월" → 해당 월 1일 ~ 말일
- "내일" → 내일 날짜
- "주말" → 이번 주 토~일

[출력 형식]
반드시 아래 JSON 형식으로만 응답하세요:
{
  "intent": "SEARCH_TOURNAMENT" | "VIEW_BRACKET" | "VIEW_RESULTS" | "VIEW_REQUIREMENTS" | "HELP",
  "entities": {
    "tournament_name": "대회명 또는 null",
    "location": "지역명 또는 null",
    "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } 또는 null,
    "date_expression": "원본 날짜 표현 또는 null",
    "player_name": "선수명 또는 null",
    "status": "모집중|진행중|완료 또는 null"
  },
  "confidence": 0.0~1.0,
  "requires_auth": false
}

[규칙]
- 테니스/대회와 무관한 질문은 confidence를 0.3 이하로 설정
- 모호한 질문은 HELP로 분류하고 confidence 0.5 이하
- 절대 JSON 외의 텍스트를 출력하지 마세요
```

**핵심 결정:**
- `date_range`는 Gemini에게 위임 (한국어 날짜 표현 → ISO 변환)
- `requires_auth`는 Phase 1에서 항상 `false` (Phase 2에서 회원 Intent 추가 시 활용)
- confidence < 0.7 → `HELP` fallback (Route Handler에서 처리)

---

## 4. Intent 분류 엔진

### 파일: `src/lib/chat/classify.ts`

```typescript
import { GoogleGenAI } from '@google/genai'
import type { IntentClassification } from './types'
import { buildSystemPrompt } from './prompts'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/** Gemini 2.0 Flash로 Intent 분류 + Entity 추출 */
export async function classifyIntent(message: string): Promise<IntentClassification>
```

**구현 핵심:**

```typescript
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: message,
  config: {
    systemInstruction: buildSystemPrompt(),
    responseMimeType: 'application/json',
    temperature: 0.1,           // 분류 작업 → 낮은 temperature
    maxOutputTokens: 300,       // Intent JSON만 반환하므로 충분
  },
})
```

**에러 처리:**
- API 키 미설정 → throw (`GEMINI_API_KEY 환경변수가 설정되지 않았습니다.`)
- Gemini API 호출 실패 → throw (Route Handler에서 catch)
- JSON 파싱 실패 → `{ intent: 'HELP', confidence: 0, ... }` fallback
- confidence < 0.7 → intent를 `HELP`로 오버라이드

---

## 5. Intent Handlers

### 파일: `src/lib/chat/handlers/index.ts`

```typescript
import type { IntentHandler, Intent } from '../types'
import { handleSearchTournament } from './searchTournament'
import { handleViewBracket } from './viewBracket'
import { handleViewResults } from './viewResults'
import { handleViewRequirements } from './viewRequirements'
import { handleHelp } from './help'

const handlers: Record<Intent, IntentHandler> = {
  SEARCH_TOURNAMENT: handleSearchTournament,
  VIEW_BRACKET: handleViewBracket,
  VIEW_RESULTS: handleViewResults,
  VIEW_REQUIREMENTS: handleViewRequirements,
  HELP: handleHelp,
}

export function getHandler(intent: Intent): IntentHandler {
  return handlers[intent] ?? handleHelp
}
```

### 5.1 `handlers/searchTournament.ts`

```typescript
export async function handleSearchTournament(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult>
```

**쿼리 전략:**
```typescript
const admin = createAdminClient()
let query = admin
  .from('tournaments')
  .select('id, title, location, address, start_date, end_date, status, entry_fee, max_participants')
  .in('status', ['OPEN', 'CLOSED', 'IN_PROGRESS'])  // DRAFT, CANCELLED 제외
  .order('start_date', { ascending: true })
  .limit(5)

// 지역 필터
if (entities.location) {
  query = query.or(
    `location.ilike.%${entities.location}%,address.ilike.%${entities.location}%`
  )
}

// 날짜 범위 필터
if (entities.date_range?.start) {
  query = query.gte('start_date', entities.date_range.start)
}
if (entities.date_range?.end) {
  query = query.lte('start_date', entities.date_range.end)
}

// 상태 필터 (사용자가 명시적으로 요청한 경우)
if (entities.status) {
  const statusMap: Record<string, string> = {
    '모집중': 'OPEN', '진행중': 'IN_PROGRESS', '완료': 'COMPLETED',
  }
  const mapped = statusMap[entities.status]
  if (mapped) query = query.eq('status', mapped)
}
```

**응답 포매팅:**
```
검색 결과 3개의 대회를 찾았습니다:

1. 서울 오픈 — 2026-03-15 / 서울 강남 (모집중)
   참가비: 30,000원 | 최대 32명

2. 강남 클럽 대회 — 2026-03-22 / 서울 강남 (모집중)
   ...

대회 상세 정보는 아래 링크에서 확인하세요.
```

**links**: 각 대회 → `{ label: "서울 오픈 상세", href: "/tournaments/{id}" }`

### 5.2 `handlers/viewBracket.ts`

```typescript
export async function handleViewBracket(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult>
```

**쿼리 전략:**
1. `tournaments` 테이블에서 대회명 검색 (`ILIKE %name%`)
2. 매칭된 대회 ID → `bracket_configs` → `bracket_matches` 조회
3. 라운드별 매치 수 + 진행 상태 요약

**응답 예시:**
```
"서울 오픈" 대진표 정보:

- 본선: 16강(8경기) → 8강(4경기) → 4강(2경기) → 결승(1경기)
- 현재 진행: 8강 진행 중 (4경기 중 2경기 완료)
```

**links**: `{ label: "대진표 보기", href: "/tournaments/{id}/bracket" }`

### 5.3 `handlers/viewResults.ts`

```typescript
export async function handleViewResults(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult>
```

**쿼리 전략:**
1. 대회명 검색 → 대회 ID
2. `bracket_matches` 중 `status = 'COMPLETED'` 필터
3. 최근 완료된 매치 5개 + 승자/스코어 요약
4. winner_entry 조인으로 승자 이름 포함

**응답 예시:**
```
"서울 오픈" 최근 경기 결과:

- 8강 1경기: 김철수 vs 이영희 → 김철수 승 (6:3)
- 8강 2경기: 박민수 vs 정호진 → 정호진 승 (7:5)
```

### 5.4 `handlers/viewRequirements.ts`

```typescript
export async function handleViewRequirements(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult>
```

**쿼리 전략:**
1. 대회명 검색 → `tournaments` + `divisions` 조인
2. 대회 형식, 참가비, 최대 인원, 일정, 장소 정보 포매팅

**응답 예시:**
```
"서울 오픈" 참가 정보:

- 일시: 2026-03-15 ~ 2026-03-16
- 장소: 서울 강남 테니스장
- 참가비: 30,000원
- 최대 인원: 32명
- 대회 형식: 단식 토너먼트
- 현재 상태: 모집중
```

### 5.5 `handlers/help.ts`

```typescript
export async function handleHelp(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult>
```

**LLM 미호출** — 하드코딩 응답:

```
Tennis Tab에서 할 수 있는 것들이에요:

- "이번 주 서울 대회 뭐 있어?" → 대회 검색
- "서울 오픈 대진표 보여줘" → 대진표 조회
- "서울 오픈 결과 알려줘" → 경기 결과 확인
- "서울 오픈 참가 조건이 뭐야?" → 참가 정보 조회

날짜, 지역, 대회명을 자유롭게 조합해서 질문해보세요!
```

---

## 6. 채팅 로그 저장

### 파일: `src/lib/chat/logs.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveChatLog(params: {
  userId?: string
  sessionId?: string
  message: string
  response: string
  intent: string
  entities: Record<string, unknown>
}): Promise<void>
```

**구현:**
```typescript
const admin = createAdminClient()
await admin.from('chat_logs').insert({
  user_id: params.userId ?? null,
  session_id: params.sessionId ?? null,
  message: params.message,
  response: params.response,
  intent: params.intent,
  entities: params.entities,
})
```

- admin client 사용 (RLS 우회)
- 저장 실패는 무시 (사용자 응답에 영향 없음)
- `try/catch`로 감싸되 에러는 `console.error`만 (프로덕션에서 로깅 서비스 연동 시 교체)

---

## 7. Rate Limiting

### 파일: `src/lib/chat/rateLimit.ts`

인메모리 Map 기반 (Phase 1). 서버 재시작 시 초기화됨.

```typescript
interface RateLimitEntry {
  count: number
  resetAt: number        // Date.now() + 60_000
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const LIMITS = {
  anonymous: 10,         // 비회원: 10회/분
  authenticated: 30,     // 회원: 30회/분
} as const

/** Rate limit 확인. 초과 시 { limited: true, retryAfter } 반환 */
export function checkRateLimit(
  key: string,
  isAuthenticated: boolean
): { limited: boolean; retryAfter?: number }
```

**key 전략:**
- 비회원: IP 주소 (`request.headers.get('x-forwarded-for')` 또는 `request.ip`)
- 회원: `userId`

**만료 처리:**
- `resetAt` 이후 요청 시 count 리셋
- 주기적 cleanup은 불필요 (Map 크기가 작음, 서버 재시작 시 초기화)

---

## 8. Route Handler

### 파일: `src/app/api/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInput } from '@/lib/utils/validation'
import { classifyIntent } from '@/lib/chat/classify'
import { getHandler } from '@/lib/chat/handlers'
import { saveChatLog } from '@/lib/chat/logs'
import { checkRateLimit } from '@/lib/chat/rateLimit'
import type { ChatResponse } from '@/lib/chat/types'

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>>
```

**처리 흐름:**

```
1. Rate Limit 확인
   → 초과 시 429 { success: false, code: 'RATE_LIMIT' }

2. Request body 파싱 + 검증
   - message: string, 1~500자
   - session_id: string (선택)
   → 실패 시 400 { success: false, code: 'INVALID_INPUT' }

3. sanitizeInput(message)

4. 로그인 확인 (선택)
   - supabase.auth.getUser()
   - userId 또는 null

5. classifyIntent(sanitizedMessage)
   → confidence < 0.7 → intent = 'HELP'

6. getHandler(intent)(entities, userId)
   → HandlerResult { success, message, data, links }

7. saveChatLog({ userId, sessionId, message, response, intent, entities })
   → 비동기, 실패 무시

8. 200 { success: true, intent, message, data, links }
```

**에러 핸들링:**
```typescript
try {
  // ... 위 흐름
} catch (error) {
  // Gemini API 장애 등
  return NextResponse.json({
    success: false,
    error: '현재 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.',
    code: 'INTERNAL_ERROR',
  } as ChatResponse, { status: 500 })
}
```

---

## 9. 프론트엔드 컴포넌트

### 9.1 ChatInput 리팩토링

### 파일: `src/components/chat/ChatInput.tsx`

현재 `src/app/page.tsx`에 인라인으로 약 130줄 존재. 별도 컴포넌트로 분리.

```typescript
interface ChatInputProps {
  onResponse: (response: ChatSuccessResponse) => void
  onError: (error: string) => void
  onLoadingChange: (loading: boolean) => void
}

export function ChatInput({ onResponse, onError, onLoadingChange }: ChatInputProps)
```

**변경 사항:**
- `handleSubmit`에서 `console.log` → `POST /api/chat` 호출
- 로딩/에러 상태를 부모에 전달 (홈 페이지에서 응답 영역 제어)
- 기존 UI (입력창 + 예시 프롬프트) 그대로 유지
- `aria-label="메시지 입력"` 접근성 속성 추가

**API 호출:**
```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  const trimmed = query.trim()
  if (!trimmed) return

  onLoadingChange(true)
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    })
    const data: ChatResponse = await res.json()

    if (data.success) {
      onResponse(data)
      setQuery('')  // 입력 초기화
    } else {
      onError(data.error)
    }
  } catch {
    onError('네트워크 오류가 발생했습니다.')
  } finally {
    onLoadingChange(false)
  }
}
```

### 9.2 ChatResponse 컴포넌트

### 파일: `src/components/chat/ChatResponse.tsx`

```typescript
interface ChatResponseProps {
  response: ChatSuccessResponse | null
  loading: boolean
  error: string | null
}

export function ChatResponse({ response, loading, error }: ChatResponseProps)
```

**UI 구조:**
```
┌──────────────────────────────────────┐
│ [로딩 시] 타이핑 애니메이션 (●●●)    │
│                                      │
│ [응답 시]                            │
│ 응답 메시지 텍스트                    │
│                                      │
│ [링크 카드들]                        │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │서울오픈 │ │강남대회 │ │...     │    │
│ │상세보기 │ │상세보기 │ │        │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ [에러 시] 에러 메시지 (빨간색)        │
└──────────────────────────────────────┘
```

**접근성:**
- 컨테이너: `role="log"`, `aria-live="polite"`, `aria-label="AI 응답"`
- 로딩 시: `aria-busy="true"`
- 링크 카드: `<a>` 태그, 키보드 접근 가능

**스타일:**
- 기존 `glass-card` 패턴 활용
- 메시지: `text-(--text-primary)`, `whitespace-pre-line` (줄바꿈 유지)
- 링크 카드: `bg-(--bg-card)`, `border border-(--border-color)`, hover 효과
- 에러: `text-red-500`

### 9.3 홈 페이지 통합

### 파일: `src/app/page.tsx`

**변경 사항:**
1. 인라인 `ChatInput` 컴포넌트 삭제 → `import { ChatInput }` 교체
2. `ChatResponse` 컴포넌트 추가 (ChatInput 아래)
3. 상태 관리:

```typescript
const [chatResponse, setChatResponse] = useState<ChatSuccessResponse | null>(null)
const [chatLoading, setChatLoading] = useState(false)
const [chatError, setChatError] = useState<string | null>(null)
```

4. 레이아웃:
```tsx
<ChatInput
  onResponse={(res) => { setChatResponse(res); setChatError(null) }}
  onError={(err) => { setChatError(err); setChatResponse(null) }}
  onLoadingChange={setChatLoading}
/>
<ChatResponse
  response={chatResponse}
  loading={chatLoading}
  error={chatError}
/>
```

**주의:** `ChatInput`은 `'use client'` 컴포넌트. 홈 페이지 전체를 client로 변환하지 않도록 `ChatInput` + `ChatResponse`를 감싸는 래퍼 컴포넌트(`ChatSection`)를 만들어 서버 컴포넌트인 `page.tsx`에서 import.

### 파일: `src/components/chat/ChatSection.tsx`

```typescript
'use client'

import { useState } from 'react'
import { ChatInput } from './ChatInput'
import { ChatResponse } from './ChatResponse'
import type { ChatSuccessResponse } from '@/lib/chat/types'

/** 홈 페이지용 채팅 섹션 (ChatInput + ChatResponse 래퍼) */
export function ChatSection()
```

`page.tsx`에서는 기존 인라인 `ChatInput` → `<ChatSection />` 교체.

---

## 10. 디렉토리 구조 (최종)

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts              # POST /api/chat
│   └── page.tsx                      # ChatSection 통합
├── lib/
│   └── chat/
│       ├── types.ts                  # Intent, Entity, Response 타입
│       ├── classify.ts               # Gemini 2.0 Flash 호출
│       ├── prompts.ts                # System Instruction 빌더
│       ├── rateLimit.ts              # 인메모리 Rate Limiting
│       ├── logs.ts                   # chat_logs INSERT
│       └── handlers/
│           ├── index.ts              # Intent → Handler 라우팅
│           ├── searchTournament.ts   # SEARCH_TOURNAMENT
│           ├── viewBracket.ts        # VIEW_BRACKET
│           ├── viewResults.ts        # VIEW_RESULTS
│           ├── viewRequirements.ts   # VIEW_REQUIREMENTS
│           └── help.ts               # HELP (하드코딩)
└── components/
    └── chat/
        ├── ChatSection.tsx           # 홈 페이지 래퍼 ('use client')
        ├── ChatInput.tsx             # 입력 UI + API 호출
        └── ChatResponse.tsx          # 응답 표시 UI
```

---

## 11. 구현 순서

| 단계 | 작업 | 파일 | 의존성 |
|:----:|------|------|--------|
| 1 | `@google/genai` 설치 + `GEMINI_API_KEY` 환경변수 | `package.json`, `.env.local` | 없음 |
| 2 | 타입 정의 | `src/lib/chat/types.ts` | 없음 |
| 3 | System Prompt 작성 | `src/lib/chat/prompts.ts` | 없음 |
| 4 | Intent 분류 엔진 | `src/lib/chat/classify.ts` | 2, 3 |
| 5 | HELP 핸들러 (하드코딩) | `src/lib/chat/handlers/help.ts` | 2 |
| 6 | Handler 라우팅 + 나머지 핸들러 4종 | `src/lib/chat/handlers/*.ts` | 2, 5 |
| 7 | 채팅 로그 저장 | `src/lib/chat/logs.ts` | 2 |
| 8 | Rate Limiting | `src/lib/chat/rateLimit.ts` | 없음 |
| 9 | Route Handler | `src/app/api/chat/route.ts` | 4, 6, 7, 8 |
| 10 | ChatInput 분리 + ChatResponse + ChatSection | `src/components/chat/*.tsx` | 2, 9 |
| 11 | 홈 페이지 통합 | `src/app/page.tsx` | 10 |

---

## 12. 보안 체크리스트

- [ ] `sanitizeInput()` — 사용자 메시지 XSS 방지
- [ ] `message` 길이 검증: 1~500자
- [ ] Prompt Injection 방어: System Instruction에 역할 고정 + JSON only 출력 강제
- [ ] `GEMINI_API_KEY` 서버 사이드만 접근 (클라이언트 노출 불가)
- [ ] Rate Limiting: 비회원 10/분, 회원 30/분
- [ ] Supabase ILIKE 쿼리: `%` 와일드카드 injection 방지 (entities에서 `%`, `_` 이스케이프)
- [ ] `chat_logs` INSERT는 admin client (RLS 우회)

---

## 13. 접근성 (WCAG 2.1 AA)

| 컴포넌트 | 속성 | 설명 |
|----------|------|------|
| ChatInput `<input>` | `aria-label="메시지 입력"` | 레이블 |
| ChatInput `<form>` | `noValidate` | 브라우저 네이티브 검증 비활성화 |
| ChatInput `<button>` | `aria-label="전송"` | 전송 버튼 |
| ChatResponse 컨테이너 | `role="log"`, `aria-live="polite"` | 새 응답 스크린리더 알림 |
| ChatResponse 로딩 | `aria-busy="true"` | 로딩 상태 표시 |
| 링크 카드 | `<a href>` | 키보드 접근 가능 |

---

## 14. 검증 기준

### 기능
- [ ] ChatInput에서 메시지 입력 → API 호출 → ChatResponse에 응답 표시
- [ ] "이번 주 서울 대회" → SEARCH_TOURNAMENT → 대회 목록 반환
- [ ] "서울 오픈 대진표" → VIEW_BRACKET → 대진표 정보 + 링크
- [ ] "서울 오픈 결과" → VIEW_RESULTS → 경기 결과
- [ ] "참가 조건" → VIEW_REQUIREMENTS → 대회 상세
- [ ] "뭘 할 수 있어?" → HELP → 기능 안내 (LLM 미호출)
- [ ] 의미 없는 입력 → confidence < 0.7 → HELP fallback
- [ ] chat_logs에 모든 대화 기록 저장
- [ ] 예시 프롬프트 클릭 → 자동 전송

### 보안/성능
- [ ] Rate Limiting (비회원 10/분, 회원 30/분)
- [ ] 500자 초과 → INVALID_INPUT 에러
- [ ] Gemini API 장애 → 사용자 친화적 에러 메시지
- [ ] sanitizeInput() 적용

### 빌드
- [ ] TypeScript `tsc --noEmit` 통과
- [ ] `next build` 통과
