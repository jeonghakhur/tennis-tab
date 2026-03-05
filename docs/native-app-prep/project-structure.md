# 프로젝트 구조 결정

> 네이티브 앱 개발을 위한 프로젝트 구조 옵션과 권장 사항.

---

## 권장: Turborepo 모노레포

### 구조

```
tennis-tab-monorepo/
├── apps/
│   ├── web/                    ← 현재 Next.js 프로젝트 이동 (거의 그대로)
│   │   ├── src/
│   │   ├── package.json        ← web-specific deps만
│   │   └── next.config.ts
│   │
│   └── mobile/                 ← 새 Expo 앱
│       ├── app/                ← Expo Router (파일 기반 라우팅)
│       │   ├── (tabs)/
│       │   │   ├── index.tsx
│       │   │   ├── clubs.tsx
│       │   │   ├── awards.tsx
│       │   │   ├── community.tsx
│       │   │   └── my.tsx
│       │   ├── (auth)/
│       │   │   ├── login.tsx
│       │   │   └── signup.tsx
│       │   ├── tournaments/[id]/
│       │   ├── clubs/[id]/
│       │   └── community/[id]/
│       ├── components/
│       ├── package.json
│       └── app.config.ts
│
├── packages/
│   ├── types/                  ← 공유 TypeScript 타입
│   │   ├── src/
│   │   │   └── index.ts        ← src/lib/supabase/types.ts 이동
│   │   └── package.json
│   │
│   ├── utils/                  ← 공유 유틸 함수
│   │   ├── src/
│   │   │   ├── validation.ts
│   │   │   ├── korean.ts
│   │   │   ├── formatDate.ts
│   │   │   └── phone.ts
│   │   └── package.json
│   │
│   └── supabase/               ← Supabase 클라이언트 + 공유 쿼리
│       ├── src/
│       │   ├── queries/        ← 플랫폼 무관 쿼리 함수
│       │   │   ├── tournaments.ts
│       │   │   ├── clubs.ts
│       │   │   ├── bracket.ts
│       │   │   └── user.ts
│       │   └── types.ts        ← @packages/types re-export
│       └── package.json
│
├── turbo.json
└── package.json
```

### 장점
- 타입/유틸 코드를 한 곳에서 관리
- 웹/앱 동시 변경 시 단일 PR
- `turbo run build` 병렬 빌드
- 공유 ESLint/TypeScript 설정

### 단점
- 초기 설정 오버헤드 (~반나절)
- Expo와 Next.js의 Metro/Webpack 번들러 충돌 주의
  - `packages/`는 Pure JS/TS만 (React Native 코드 금지)

---

## 대안: 별도 레포

```
tennis-tab/          ← 현재 레포 유지
tennis-tab-mobile/   ← 새 Expo 레포
```

### 장점
- 설정 없이 즉시 시작 가능
- 각 앱의 의존성 완전 분리
- 팀 규모가 작을 때 더 단순

### 단점
- 타입/유틸 변경 시 두 레포 동시 수정
- 공유 코드 drift 위험

---

## 권장 결정

**단계적 접근:**

1. **단기 (초기 개발)**: 별도 레포로 시작
   - `tennis-tab` 현재 레포 유지
   - `tennis-tab-mobile` 새 Expo 레포 생성
   - 공유 코드는 복사·붙여넣기로 관리
   - 이유: 모노레포 설정 없이 빠르게 검증 가능

2. **중기 (안정화 후)**: 모노레포로 통합
   - 공유 코드 drift가 생기기 시작하면 전환
   - Turborepo migration 비용은 낮음

---

## Expo 앱 초기 설정

### 의존성

```json
{
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~4.0.0",
    "react-native": "0.76.x",
    "@supabase/supabase-js": "^2.x",
    "expo-secure-store": "~14.0.0",
    "expo-image": "~2.0.0",
    "expo-image-picker": "~16.0.0",
    "nativewind": "^4.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.21.0",
    "react-native-safe-area-context": "4.14.0",
    "react-native-screens": "~4.4.0",
    "@react-native-async-storage/async-storage": "^2.1.0",
    "zustand": "^5.0.0",
    "react-native-toast-message": "^2.2.0"
  }
}
```

### 인증 설정 (Supabase + expo-secure-store)

```ts
// apps/mobile/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// expo-secure-store는 최대 2KB 제한 — 큰 토큰 대응 필요
class LargeSecureStore {
  private async _setValue(key: string, value: string) {
    if (value.length > 2048) {
      // AsyncStorage로 fallback (토큰 크기가 큰 경우)
      await AsyncStorage.setItem(key, value)
    } else {
      await SecureStore.setItemAsync(key, value)
    }
  }
  async getItem(key: string) {
    const secureValue = await SecureStore.getItemAsync(key)
    if (secureValue) return secureValue
    return AsyncStorage.getItem(key)
  }
  async setItem(key: string, value: string) { await this._setValue(key, value) }
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key)
    await AsyncStorage.removeItem(key)
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

### Realtime 구독 패턴 (React Native)

```ts
// 웹과 동일한 @supabase/supabase-js API 사용
useEffect(() => {
  const channel = supabase
    .channel('bracket-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bracket_matches',
      filter: `bracket_config_id=eq.${configId}`,
    }, (payload) => {
      handleMatchUpdate(payload)
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [configId])
```

---

## 환경 변수

| 웹 (Next.js) | 네이티브 (Expo) |
|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ 절대 포함 금지 |

> Expo의 `EXPO_PUBLIC_*` 변수는 번들에 포함됨 — 공개 키만 사용.
