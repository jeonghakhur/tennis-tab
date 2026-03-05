# 공유 가능한 코드 분석

> 웹 → 네이티브 앱 개발 시 재사용 가능한 코드와 재구현이 필요한 코드를 구분.

---

## ✅ 그대로 재사용 가능

### TypeScript 타입 (`src/lib/supabase/types.ts`)

```ts
// 모두 재사용 가능
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'RESTRICTED'
export type TournamentStatus = ...
export type TournamentFormat = ...
export type MatchType = ...
export type BracketStatus = ...
export type EntryStatus = ...
export type PaymentStatus = ...
export type MatchPhase = ...
export type MatchStatus = ...
export type ClubJoinType = ...
export type ClubMemberRole = ...
export type ClubMemberStatus = ...
export type StartYear = ...
export interface PartnerData { ... }
export interface TeamMember { ... }
export interface SetDetail { ... }
export interface Database { ... }  // Supabase generated types
```

### 순수 유틸 함수 (`src/lib/utils/`)

| 파일 | 재사용 가능 여부 | 비고 |
|------|----------------|------|
| `validation.ts` | ✅ 100% | DOM/브라우저 의존성 없음 |
| `korean.ts` | ✅ 100% | 순수 JS 로직 |
| `formatDate.ts` | ✅ 100% | 순수 JS 로직 |
| `phone.ts` | ✅ 100% | 순수 JS 로직 |
| `devDummy.ts` | ✅ 100% | `@faker-js/faker` — RN에서도 동작 |

### 브래킷 알고리즘 로직 (`src/lib/bracket/actions.ts`)

쿼리 로직을 Server Action에서 분리하면 재사용 가능:
- `generateMainBracket` 알고리즘 (시드 배치, BYE 처리)
- `generateTeamMatchAutoResult` (세트별 자동 결과 생성)
- 라운드 계산 함수들

**작업 필요:** Server Action 코드에서 순수 함수를 분리하여 별도 파일로 추출

### 인증 역할 체계 (`src/lib/auth/roles.ts`)

```ts
// hasMinimumRole 등 순수 함수 — 재사용 가능
export function hasMinimumRole(userRole: UserRole, minRole: UserRole): boolean
```

---

## ⚠️ 변환 필요

### Supabase 클라이언트

| 현재 (웹) | 네이티브 변환 |
|---------|-------------|
| `@supabase/ssr` + `createServerClient` | 제거 |
| `@supabase/ssr` + `createBrowserClient` | `@supabase/supabase-js` + `createClient`로 교체 |
| 쿠키 기반 세션 | `expo-secure-store` 기반 세션 |

```ts
// 네이티브 Supabase 클라이언트 예시
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { LargeSecureStore } from './LargeSecureStore'  // 512B 이상 토큰 대응

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // React Native에서 false
  },
})
```

### Server Actions → 직접 Supabase 쿼리

Server Action은 Next.js 전용. 네이티브에서는 Supabase JS client 직접 호출.

```ts
// 웹: Server Action
'use server'
export async function getMyTournaments(userId: string) {
  const supabase = await createClient()  // @supabase/ssr
  return supabase.from('tournament_entries').select('...').eq('user_id', userId)
}

// 네이티브: 직접 호출
import { supabase } from '@/lib/supabase'
export async function getMyTournaments(userId: string) {
  return supabase.from('tournament_entries').select('...').eq('user_id', userId)
}
```

**변환 대상 파일 (전체 목록):**
- `src/lib/bracket/actions.ts` (뮤테이션 포함 — 권한 체크 클라이언트 이동 필요)
- `src/lib/auth/actions.ts`
- `src/lib/data/user.ts`
- `src/lib/tournaments/actions.ts`
- `src/lib/clubs/actions.ts`
- `src/lib/community/actions.ts`
- `src/lib/awards/actions.ts`
- `src/lib/entries/actions.ts` (참가 신청 관련)
- `src/lib/payment/actions.ts` (TossPayments 연동 — 네이티브에서는 재설계 필요)
- `src/lib/associations/actions.ts` (협회 관리)
- `src/lib/support/actions.ts` (고객 문의)
- `src/lib/faq/actions.ts` (FAQ)
- `src/lib/storage/actions.ts` (파일 업로드 — Supabase Storage, 네이티브에서 재사용 가능)

### Realtime 훅 (`src/lib/realtime/`)

웹과 네이티브 모두 `@supabase/supabase-js` API를 동일하게 사용하므로 훅 로직 재사용 가능.
단, React Native에서는 `useEffect` cleanup 패턴이 동일하게 작동함.

| 파일 | 설명 | 재사용 가능 여부 |
|------|------|:--------------:|
| `useMatchesRealtime.ts` | bracket_matches 실시간 구독 | 재사용 가능 |
| `useTournamentStatusRealtime.ts` | tournaments 상태 실시간 구독 | 재사용 가능 |
| `useClubMembersRealtime.ts` | club_members 실시간 구독 | 재사용 가능 |
| `useBracketConfigRealtime.ts` | bracket_configs (active_phase/active_round) 실시간 구독 | 재사용 가능 |

> React 18 Batching 주의사항 (`CLAUDE.md` 참조) — 연속 setState 패턴은 네이티브에서도 동일하게 적용됨.

### NLP 챗봇 시스템 (`src/lib/chat/` — 21개 파일)

챗봇은 Server Action 기반으로 구현되어 있어 네이티브에서 직접 재사용 불가.

- 변환 방향: Server Action → API Route (Next.js) 또는 Supabase Edge Function으로 분리
- 네이티브 앱에서는 해당 API를 HTTP로 호출하는 방식으로 통합
- **초기 네이티브 버전에서는 챗봇 제외 권장** → 안정화 후 API 기반으로 추가

---

## ❌ 재구현 필요

### UI 컴포넌트 전체

모든 React 컴포넌트는 재구현 필요. 아래는 주요 매핑:

| 웹 구현 | 네이티브 대안 |
|---------|-------------|
| Tailwind CSS v4 | NativeWind v4 (권장) or StyleSheet |
| `next/navigation` (`useRouter`, `Link`) | Expo Router (`useRouter`, `Link`) |
| `next/image` | `expo-image` |
| `next/link` | `expo-router/link` |
| HTML `<button>` | React Native `<Pressable>` |
| HTML `<input>` | React Native `<TextInput>` |
| HTML `<select>` | React Native `<Picker>` or 커스텀 모달 |
| `Modal` 컴포넌트 | `react-native-modal` or RN `<Modal>` |
| `Toast` 컴포넌트 | `react-native-toast-message` |
| `Badge` 컴포넌트 | 직접 구현 (View + Text) |
| `LoadingOverlay` | ActivityIndicator + Modal |

### 드래그앤드롭 (GroupsTab - 조편성)

| 웹 구현 | 네이티브 대안 |
|---------|-------------|
| `dnd-kit` | `react-native-draggable-flatlist` |

> ⚠️ 조편성 DnD는 어드민 전용이므로 네이티브 앱에서는 불필요.

### 리치 텍스트 에디터 (커뮤니티)

| 웹 구현 | 네이티브 대안 |
|---------|-------------|
| TipTap | `@10play/tentap-editor` (TipTap 기반 RN 포트, 권장) |

### 결제

| 웹 구현 | 네이티브 대안 |
|---------|-------------|
| TossPayments Web SDK | WebView 임베드 (단기) → TossPayments 모바일 SDK (장기) |

---

## 공유 패키지 추출 계획

모노레포 구성 시 독립 패키지로 추출할 코드:

```
packages/
├── types/
│   └── src/
│       └── index.ts    ← src/lib/supabase/types.ts 이동
│
├── utils/
│   └── src/
│       ├── validation.ts
│       ├── korean.ts
│       ├── formatDate.ts
│       ├── phone.ts
│       └── devDummy.ts
│
└── supabase/
    └── src/
        ├── client.ts   ← 웹/네이티브 각각 구현
        ├── queries/    ← 공유 쿼리 함수 (플랫폼 무관)
        └── types.ts    ← @packages/types에서 re-export
```
