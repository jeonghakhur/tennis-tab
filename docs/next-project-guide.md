# 다음 프로젝트 개발 가이드

> tennis-tab 프로젝트 경험을 기반으로 정리한 풀스택 웹 개발 가이드.
> UX 중심 설계, 웹 접근성, Claude 협업 전략을 핵심으로 한다.

---

## 1. 개발 워크플로우

### 원칙: 디자인 먼저, 코드는 나중에

```
1. 기획/요구사항 정리
   └─ 도메인 모델 정의 (엔티티, 관계, 상태 전이)

2. 디자인 플로우 설계
   └─ 화면 흐름도 (Figma/FigJam 또는 종이)
   └─ 각 화면의 상태: 로딩, 빈 상태, 에러, 성공
   └─ 반응형 브레이크포인트 결정

3. 디자인 플로우 검증
   └─ 사용자 시나리오 워크스루
   └─ 접근성 체크 (키보드 탐색 순서, 포커스 이동)
   └─ 엣지 케이스 확인 (긴 텍스트, 빈 목록, 권한 없음)

4. 컴포넌트 설계
   └─ 페이지별 컴포넌트 트리 스케치
   └─ 공통 컴포넌트 식별 (Modal, Alert, Badge 등)
   └─ 컴포넌트당 단일 책임 원칙 (300줄 이내 목표)

5. 프론트엔드 개발
   └─ 공통 컴포넌트 → 페이지 컴포넌트 순서

6. 백엔드 연동
   └─ Server Actions / API Routes
   └─ 입력 검증 (3-Layer)
```

### 왜 이 순서인가

tennis-tab에서 기능 중심으로 빠르게 개발하다 보니 컴포넌트가 비대해졌다 (40~59KB 단일 파일).
디자인 플로우를 먼저 확정하면 **컴포넌트 분리 기준이 처음부터 명확**해진다.

---

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| Framework | Next.js (App Router) | SSR/SSG, Server Actions, 파일 기반 라우팅 |
| 언어 | TypeScript (strict) | 타입 안정성, 리팩토링 안전성 |
| 스타일링 | **Bootstrap SCSS 클론** | 커스터마이징 자유도, 검증된 반응형 시스템 |
| UI 컴포넌트 | **Bootstrap 컴포넌트 클론** | 라이브러리 의존 없이 완전한 제어 |
| 상태 관리 | Zustand | 가볍고 직관적, 보일러플레이트 최소 |
| 폼 관리 | react-hook-form + zod | 스키마 기반 검증, 리렌더링 최소화 |
| DB | 프로젝트별 선택 | Next.js + 선택한 DB |
| 테스트 | Vitest (단위) + Playwright (E2E) | 빠른 단위 테스트 + 브라우저 E2E |

---

## 3. Bootstrap SCSS 클론 전략

### 왜 라이브러리 대신 클론인가

- 라이브러리 사용 시 컴포넌트 수정이 제한적
- 프로젝트에 필요한 부분만 가져와서 번들 최적화
- SCSS 변수 오버라이드로 디자인 토큰 완전 제어

### 디렉토리 구조

```
src/
├── styles/
│   ├── _variables.scss        # 디자인 토큰 (색상, 간격, 타이포, 브레이크포인트)
│   ├── _mixins.scss           # 반응형, 접근성 믹스인
│   ├── _utilities.scss        # 유틸리티 클래스 (Bootstrap 기반)
│   ├── _reset.scss            # CSS 리셋/노멀라이즈
│   ├── _accessibility.scss    # 포커스 스타일, sr-only, 명도대비
│   ├── _transitions.scss      # 공통 트랜지션/애니메이션
│   ├── components/
│   │   ├── _buttons.scss
│   │   ├── _forms.scss
│   │   ├── _cards.scss
│   │   ├── _badges.scss
│   │   ├── _modals.scss
│   │   ├── _alerts.scss
│   │   ├── _tables.scss
│   │   ├── _navs.scss
│   │   └── _dropdowns.scss
│   └── globals.scss           # 엔트리 포인트 (모든 파셜 import)
```

### 디자인 토큰 시스템 (`_variables.scss`)

```scss
// ===========================
// 1. 색상 시스템
// ===========================

// 브랜드 색상
$primary:       #0d6efd;
$secondary:     #6c757d;
$success:       #198754;
$danger:        #dc3545;
$warning:       #ffc107;
$info:          #0dcaf0;

// 시맨틱 색상 (다크/라이트 테마용 CSS 변수로 관리)
:root {
  // 텍스트
  --text-primary:     #{$gray-900};
  --text-secondary:   #{$gray-600};
  --text-muted:       #{$gray-500};

  // 배경
  --bg-body:          #{$white};
  --bg-surface:       #{$gray-50};
  --bg-input:         #{$white};

  // 테두리
  --border-color:     #{$gray-300};
  --border-focus:     #{$primary};

  // 상태 색상 (Subtle 배경)
  --success-subtle:   #{rgba($success, 0.08)};
  --danger-subtle:    #{rgba($danger, 0.08)};
  --warning-subtle:   #{rgba($warning, 0.08)};
  --info-subtle:      #{rgba($info, 0.08)};
}

[data-theme="dark"] {
  --text-primary:     #{$gray-100};
  --text-secondary:   #{$gray-400};
  --bg-body:          #{$gray-900};
  --bg-surface:       #{$gray-800};
  --bg-input:         #{$gray-800};
  --border-color:     #{$gray-700};
  // ...
}

// ===========================
// 2. 타이포그래피
// ===========================
$font-family-base:    'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
$font-size-base:      1rem;      // 16px
$font-size-sm:        0.875rem;  // 14px
$font-size-lg:        1.125rem;  // 18px
$font-size-xs:        0.75rem;   // 12px

$font-weight-normal:  400;
$font-weight-medium:  500;
$font-weight-semibold: 600;
$font-weight-bold:    700;

$line-height-base:    1.5;
$line-height-tight:   1.25;

// ===========================
// 3. 간격 (8px 기반)
// ===========================
$spacer:    1rem;  // 16px
$spacers: (
  0: 0,
  1: $spacer * 0.25,   // 4px
  2: $spacer * 0.5,    // 8px
  3: $spacer,           // 16px
  4: $spacer * 1.5,    // 24px
  5: $spacer * 2,      // 32px
  6: $spacer * 3,      // 48px
);

// ===========================
// 4. 브레이크포인트
// ===========================
$breakpoints: (
  sm: 576px,
  md: 768px,
  lg: 992px,
  xl: 1200px,
  xxl: 1400px,
);

// ===========================
// 5. 그림자
// ===========================
$box-shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.05);
$box-shadow:       0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
$box-shadow-lg:    0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);

// ===========================
// 6. 둥근 모서리
// ===========================
$border-radius-sm:  0.25rem;  // 4px
$border-radius:     0.375rem; // 6px
$border-radius-lg:  0.5rem;   // 8px
$border-radius-xl:  0.75rem;  // 12px
$border-radius-pill: 50rem;
```

### 반응형 믹스인 (`_mixins.scss`)

```scss
// 미디어 쿼리 믹스인
@mixin media-up($breakpoint) {
  @media (min-width: map-get($breakpoints, $breakpoint)) {
    @content;
  }
}

@mixin media-down($breakpoint) {
  @media (max-width: map-get($breakpoints, $breakpoint) - 0.02px) {
    @content;
  }
}

// 사용 예
.card {
  padding: map-get($spacers, 3);

  @include media-up(md) {
    padding: map-get($spacers, 4);
  }
}
```

---

## 4. 웹 접근성 (WCAG 2.1 AA) — 필수 규칙

### 4.1 명도 대비

| 요소 | 최소 대비 | 비고 |
|------|----------|------|
| 일반 텍스트 | **4.5:1** | 본문, 레이블, 에러 메시지 |
| 큰 텍스트 (18px+ bold, 24px+ normal) | **3:1** | 제목, 버튼 텍스트 |
| UI 컴포넌트/그래픽 | **3:1** | 아이콘, 테두리, 포커스 링 |
| 비활성(disabled) 요소 | 면제 | 대비 규칙 적용 안됨 |

```scss
// _accessibility.scss

// 접근성 검증이 된 색상 조합만 사용
// 다크 테마에서도 대비를 유지하려면 CSS 변수로 관리
.text-danger {
  color: var(--text-danger); // light: #dc3545 (대비 4.88:1), dark: #fb7185 (대비 5.2:1)
}

// 플레이스홀더 텍스트도 대비 유지
input::placeholder {
  color: var(--text-muted);
  opacity: 0.65; // 최소 대비 확보
}
```

### 4.2 포커스 관리

```scss
// _accessibility.scss

// 1) 모든 인터랙티브 요소에 가시적 포커스 링
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

// 마우스 클릭 시 포커스 링 숨기기 (키보드 사용자에게만 표시)
:focus:not(:focus-visible) {
  outline: none;
}

// 2) 스크린 리더 전용 텍스트
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// sr-only이지만 포커스 시 표시 (스킵 링크용)
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### 4.3 모달/다이얼로그 포커스 트랩

```tsx
// 모든 모달 필수 패턴
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  // ...
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // 열릴 때 포커스 이동
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [isOpen])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // body 스크롤 차단
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  )
}
```

### 4.4 폼 접근성

```tsx
// 모든 input에 label 연결 필수
<div className="form-group">
  <label htmlFor="user-name" className="form-label">
    이름 <span className="text-danger">*</span>
  </label>
  <input
    id="user-name"
    type="text"
    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
    aria-invalid={!!errors.name}
    aria-describedby={errors.name ? 'name-error' : undefined}
    {...register('name')}
  />
  {errors.name && (
    <div id="name-error" className="invalid-feedback" role="alert">
      {errors.name.message}
    </div>
  )}
</div>
```

### 4.5 시맨틱 HTML 규칙

| 상황 | 올바른 태그 | 금지 |
|------|------------|------|
| 클릭 동작 | `<button>` | `<div onClick>` |
| 페이지 이동 | `<a href>` 또는 `<Link>` | `<div onClick={navigate}>` |
| 목록 | `<ul>/<ol> + <li>` | `<div>` 나열 |
| 표 데이터 | `<table> + <th>` | `<div>` 격자 |
| 페이지 영역 | `<main>`, `<nav>`, `<aside>`, `<footer>` | 전부 `<div>` |
| 제목 계층 | `<h1>` ~ `<h6>` 순서대로 | 건너뛰기 금지 |

### 4.6 접근성 체크리스트

개발 완료 후 반드시 확인:

- [ ] 키보드만으로 모든 기능 사용 가능
- [ ] Tab 순서가 논리적 (좌→우, 위→아래)
- [ ] 모달 열림 시 포커스 이동, 닫힘 시 원래 요소로 복귀
- [ ] 모든 이미지에 alt 텍스트 (장식용은 alt="")
- [ ] 모든 input에 label 또는 aria-label
- [ ] 에러 메시지가 aria-describedby로 연결
- [ ] 색상만으로 정보를 전달하지 않음 (아이콘/텍스트 병행)
- [ ] 텍스트 명도대비 4.5:1 이상
- [ ] 포커스 링이 가시적
- [ ] 스크린 리더로 핵심 플로우 테스트

---

## 5. UI 컴포넌트 클론 설계

### 컴포넌트 목록 (Bootstrap 기반, 프로젝트에 맞게 클론)

```
src/components/
├── common/
│   ├── Modal.tsx            # 범용 모달 (Portal, 포커스 관리, ARIA)
│   │   ├── Modal.Header
│   │   ├── Modal.Body
│   │   └── Modal.Footer
│   ├── AlertDialog.tsx      # 확인 알림 (info/warning/error/success)
│   ├── ConfirmDialog.tsx    # 확인/취소 다이얼로그
│   ├── Toast.tsx            # 자동 닫기 알림 (top-right, 3초)
│   ├── Badge.tsx            # 상태 배지 (7가지 variant)
│   ├── LoadingOverlay.tsx   # 전체 화면 로딩
│   ├── Spinner.tsx          # 로컬 스피너
│   ├── Card.tsx             # 카드 컨테이너
│   ├── Dropdown.tsx         # 드롭다운 메뉴
│   └── Pagination.tsx       # 페이지네이션
├── forms/
│   ├── FormGroup.tsx        # label + input + error 래퍼
│   ├── FormSelect.tsx       # 셀렉트 박스
│   ├── FormCheck.tsx        # 체크박스/라디오
│   ├── FormTextarea.tsx     # 텍스트영역
│   └── PhoneInput.tsx       # 전화번호 입력 (한국)
├── layout/
│   ├── Container.tsx        # 반응형 컨테이너
│   ├── Row.tsx              # 그리드 행
│   └── Col.tsx              # 그리드 열
└── ui/
    ├── Button.tsx           # 버튼 (variant, size, loading)
    ├── Table.tsx            # 테이블 (반응형)
    ├── Nav.tsx              # 네비게이션/탭
    └── ImageUpload.tsx      # 이미지 업로드 + 미리보기
```

### 컴포넌트 설계 원칙

```
1. 단일 책임: 컴포넌트당 1가지 역할, 300줄 이내
2. Props 인터페이스 명시: 모든 props에 TypeScript 인터페이스
3. 접근성 내장: ARIA 속성이 컴포넌트 내부에서 자동 처리
4. 스타일 확장: className prop으로 외부에서 스타일 추가 가능
5. 컴파운드 패턴: Modal.Body, Modal.Footer 같은 하위 컴포넌트
```

### Badge 컴포넌트 예시

```tsx
// src/components/common/Badge.tsx
import type { ReactNode } from 'react'

export type BadgeVariant =
  | 'secondary' | 'success' | 'danger'
  | 'warning' | 'info' | 'purple' | 'orange'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}

// 상태 config 패턴 (재사용)
// 도메인별 상태 → Badge variant 매핑을 한 곳에서 관리
const statusConfig: Record<Status, { label: string; variant: BadgeVariant }> = {
  OPEN:   { label: '모집중', variant: 'success' },
  CLOSED: { label: '마감',   variant: 'orange' },
}
```

---

## 6. 상태 관리 (Zustand)

### 스토어 구조

```
src/stores/
├── useAuthStore.ts          # 인증 상태 (user, role, isLoading)
├── useUIStore.ts            # UI 상태 (theme, sidebarOpen, toast)
└── [도메인]Store.ts         # 도메인별 스토어 (필요한 경우만)
```

### 패턴

```typescript
// src/stores/useAuthStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  role: UserRole | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setRole: (role: UserRole | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setRole: (role) => set({ role }),
  reset: () => set({ user: null, role: null, isLoading: false }),
}))

// 컴포넌트에서 사용: 필요한 값만 선택 (리렌더링 최소화)
const user = useAuthStore((state) => state.user)
const role = useAuthStore((state) => state.role)
```

### Zustand 사용 기준

| 상황 | 선택 |
|------|------|
| 서버 데이터 (목록, 상세) | Server Component / fetch |
| 전역 UI 상태 (테마, 토스트) | Zustand |
| 인증 상태 | Zustand |
| 폼 로컬 상태 | react-hook-form |
| 컴포넌트 내부 상태 | useState |

---

## 7. 폼 관리 (react-hook-form + zod)

### 패턴

```typescript
// 1. zod 스키마 정의 (클라이언트 + 서버 양쪽 사용)
// src/lib/[도메인]/schema.ts
import { z } from 'zod'

export const clubSchema = z.object({
  name: z.string()
    .min(2, '클럽 이름은 2자 이상이어야 합니다.')
    .max(50, '클럽 이름은 50자 이하여야 합니다.')
    .transform((v) => v.replace(/<[^>]*>/g, '').trim()), // sanitize 내장
  description: z.string().max(500).optional(),
  city: z.string().min(1, '지역을 선택해주세요.'),
  phone: z.string()
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '올바른 전화번호 형식이 아닙니다.')
    .optional()
    .or(z.literal('')), // 빈 문자열 허용 (선택 필드)
})

export type ClubFormData = z.infer<typeof clubSchema>

// 2. 폼 컴포넌트
// src/components/clubs/ClubForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clubSchema, type ClubFormData } from '@/lib/clubs/schema'

export function ClubForm({ club, onSubmit }: ClubFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<ClubFormData>({
    resolver: zodResolver(clubSchema),
    defaultValues: club ?? { name: '', description: '', city: '' },
  })

  // 제출 실패 시 첫 에러 필드로 포커스
  const onError = (fieldErrors: FieldErrors<ClubFormData>) => {
    const firstErrorField = Object.keys(fieldErrors)[0] as keyof ClubFormData
    if (firstErrorField) setFocus(firstErrorField)
  }

  const onValid = async (data: ClubFormData) => {
    const result = await onSubmit(data)
    if (result?.error) {
      // 서버 에러 처리
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid, onError)} noValidate>
      <div className="form-group">
        <label htmlFor="club-name" className="form-label">
          클럽 이름 <span className="text-danger">*</span>
        </label>
        <input
          id="club-name"
          className={`form-control ${errors.name ? 'is-invalid' : ''}`}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <div id="name-error" className="invalid-feedback" role="alert">
            {errors.name.message}
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? <Spinner size="sm" /> : '저장'}
      </button>
    </form>
  )
}

// 3. 서버 사이드 검증 (Server Action)
// src/lib/clubs/actions.ts
'use server'

import { clubSchema } from './schema'

export async function createClub(formData: ClubFormData) {
  // 동일한 zod 스키마로 서버에서도 검증
  const result = clubSchema.safeParse(formData)
  if (!result.success) {
    const firstError = result.error.errors[0]?.message
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  // DB INSERT
  // ...
}
```

### react-hook-form vs useState 직접 관리 (tennis-tab 교훈)

| 항목 | useState 직접 관리 | react-hook-form + zod |
|------|-------------------|----------------------|
| 검증 로직 | 도메인별 함수 직접 작성 | zod 스키마로 선언적 |
| 에러 포커스 | ref + errorFieldRef 수동 관리 | `setFocus()` 내장 |
| 리렌더링 | 모든 입력마다 전체 리렌더 | 변경된 필드만 리렌더 |
| 서버 검증 | 별도 함수 유지 필요 | 동일 스키마 재사용 |
| 코드량 | 많음 (FIELD_ORDER, fieldRefs 등) | 적음 |

---

## 8. 입력 보안 (3-Layer Validation)

tennis-tab에서 효과적이었던 패턴을 zod 기반으로 개선:

```
[클라이언트]              [서버 (Server Action)]    [DB]
zod 스키마 검증           zod 스키마 검증            NOT NULL, CHECK
(transform으로 sanitize)  (동일 스키마 재사용)       UNIQUE 제약
react-hook-form 에러 표시  첫 번째 에러 반환          에러 코드 변환
```

### XSS 방지 (zod transform에 내장)

```typescript
// src/lib/utils/sanitize.ts
export function sanitizeInput(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')      // HTML 태그 제거
    .replace(/javascript:/gi, '') // javascript: 프로토콜 제거
    .replace(/on\w+\s*=/gi, '')   // onXxx= 이벤트 핸들러 제거
    .trim()
}

// zod 스키마에서 사용
const nameField = z.string()
  .min(2, '2자 이상')
  .transform(sanitizeInput)
```

---

## 9. DEV 전용 더미 데이터

tennis-tab에서 **가장 생산성 높았던 패턴** 중 하나.
QA 시간을 크게 단축하고, 검증 로직 테스트가 쉬워진다.

```typescript
// src/lib/utils/devDummy.ts
import { faker } from '@faker-js/faker/locale/ko'

// 도메인별 정상 데이터 생성
export function generateClubDummy(): ClubFormData {
  return {
    name: `${faker.location.city()} 테니스클럽`,
    description: faker.lorem.sentence(),
    city: faker.location.city(),
    phone: `010${faker.string.numeric(8)}`,
  }
}

// 도메인별 잘못된 데이터 생성 (검증 테스트용)
export function generateClubInvalidDummy(): ClubFormData {
  return {
    name: pick(['', '가', '<script>alert(1)</script>']),
    description: 'x'.repeat(501), // 글자 수 초과
    city: '',
    phone: pick(['123', 'abc']),
  }
}

// 폼 컴포넌트에서 DEV 버튼 표시
// process.env.NODE_ENV === 'development' 일 때만 렌더링
// 프로덕션 빌드에서는 tree-shaking으로 제거됨
```

---

## 10. 권한 체계

```typescript
// src/lib/auth/roles.ts

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  RESTRICTED: 'RESTRICTED',
} as const

const ROLE_LEVELS: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  USER: 1,
  RESTRICTED: 0,
}

// 레벨 기반 비교
export function hasMinimumRole(
  userRole: UserRole | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole]
}

// 용도별 헬퍼
export const canManageTournaments = (role: UserRole | null) => hasMinimumRole(role, 'MANAGER')
export const isAdmin = (role: UserRole | null) => hasMinimumRole(role, 'ADMIN')

// UI용 레이블 + 색상 매핑
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '최고 관리자',
  ADMIN: '관리자',
  MANAGER: '운영자',
  USER: '일반 사용자',
  RESTRICTED: '제한 사용자',
}
```

---

## 11. 실시간 구독 패턴

tennis-tab에서 검증된 Supabase Realtime 패턴:

```typescript
// 핵심: ref로 콜백 감싸서 재구독 방지
export function useRealtimeSubscription({
  table,
  filter,
  onUpdate,
  onReload,
  enabled = true,
}: Options) {
  const updateRef = useRef(onUpdate)
  updateRef.current = onUpdate

  const reloadRef = useRef(onReload)
  reloadRef.current = onReload

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channel = supabase
      .channel(`${table}:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          // 즉시 처리 (점수 변경 등 실시간 반영)
          updateRef.current?.(payload.new)
        } else {
          // INSERT/DELETE는 디바운스 (여러 변경사항을 한 번에)
          if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
          reloadTimerRef.current = setTimeout(() => {
            reloadRef.current?.()
            reloadTimerRef.current = null
          }, 300)
        }
      })
      .subscribe()

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [table, filter, enabled])
}
```

**핵심 포인트:**
- `updateRef`로 콜백 감싸기 → 리렌더 시 재구독 방지
- UPDATE는 즉시, INSERT/DELETE는 300ms 디바운스
- cleanup에서 타이머 + 채널 모두 정리

---

## 12. React 18+ 주의사항

### Automatic Batching 함정

```typescript
// ❌ 위험: setState 함수형 업데이터 내부에서 외부 변수 설정
let needsRefetch = false
setState((prev) => {
  if (someCondition(prev)) needsRefetch = true // ← 지연 실행될 수 있음
  return newState
})
if (needsRefetch) doSomething() // ← 항상 false!

// ✅ 안전: ref로 현재 상태를 동기적으로 비교
const stateRef = useRef(state)
stateRef.current = state

const needsRefetch = someCondition(stateRef.current) // ← 즉시 평가
setState(newState)
if (needsRefetch) doSomething()
```

WebSocket(Realtime) 콜백처럼 짧은 시간에 여러 setState가 연속 호출되는 상황에서 특히 위험.

---

## 13. Claude 협업 전략

### CLAUDE.md 작성법

tennis-tab에서 효과적이었던 구조:

```markdown
# CLAUDE.md 구성

## 1. Role — Claude의 역할 정의
- 사용자 경력/전문분야 명시 → 기초 설명 생략하게 함

## 2. Priorities — 우선순위
- 타입 안정성, 접근성, 성능, 보안, 가독성 순서 명시

## 3. Forbidden — 금지 사항
- 구체적으로 나열 (any 금지, console.log 금지, div onClick 금지 등)

## 4. Preferred Patterns — 선호 패턴
- 코드 예시와 함께 작성
- "이렇게 해라" 뿐만 아니라 "이런 이유로" 포함

## 5. UI 컴포넌트 가이드 — 공통 컴포넌트 사용법
- Modal, AlertDialog, Toast 등 사용 예시
- "언제 어떤 컴포넌트를 쓸 것인가" 결정 기준

## 6. Architecture Context — 프로젝트 구조
- 디렉토리 구조, 핵심 워크플로우 설명
- 새 기능 추가 시 어디에 파일을 만들어야 하는지 가이드
```

### Claude에게 효과적으로 요청하는 법

1. **새 도메인 추가 시**: "기존 ClubForm.tsx 패턴을 따라서 LessonForm을 만들어줘"
2. **리팩토링 시**: "이 컴포넌트가 500줄인데, 단일 책임 원칙에 맞게 분리해줘"
3. **컴포넌트 비대 방지**: 기능 추가 3회마다 "이 파일 300줄 넘었으면 분리해줘" 체크

---

## 14. 프로젝트 초기 세팅 체크리스트

### Day 1: 기반 구축
- [ ] Next.js + TypeScript strict 프로젝트 생성
- [ ] Bootstrap SCSS 클론 (`_variables.scss`, `_mixins.scss`, `_accessibility.scss`)
- [ ] 디자인 토큰 정의 (색상, 타이포, 간격)
- [ ] 다크/라이트 테마 CSS 변수 세팅
- [ ] CLAUDE.md 작성 (역할, 금지사항, 선호 패턴)

### Day 2: 공통 컴포넌트
- [ ] Modal (Portal, 포커스 관리, ARIA)
- [ ] AlertDialog / ConfirmDialog / Toast
- [ ] Badge, Spinner, LoadingOverlay
- [ ] FormGroup (label + input + error 래퍼)
- [ ] Button (variant, size, loading 상태)

### Day 3: 인프라
- [ ] Zustand 스토어 (auth, UI)
- [ ] react-hook-form + zod 기본 세팅
- [ ] sanitizeInput 유틸리티
- [ ] DEV 더미 데이터 생성기 기본 구조
- [ ] 권한 체계 (`roles.ts`)

### Day 4~: 도메인 개발
- [ ] 디자인 플로우 검증 후 페이지별 개발 시작
- [ ] 각 도메인마다: zod 스키마 → 폼 컴포넌트 → Server Action → DEV 더미

---

## 15. 테스트 전략

### tennis-tab 교훈: 핵심 비즈니스 로직에 단위 테스트 필수

```
테스트 우선순위:

1. zod 스키마 검증 — 정상/비정상 입력 경계값 테스트
2. 권한 로직 — hasMinimumRole, canChangeRole 등
3. 유틸리티 함수 — sanitizeInput, formatDate, 한국어 처리
4. E2E — 핵심 사용자 플로우 (로그인 → 생성 → 수정 → 삭제)
```

```typescript
// vitest 예시
describe('clubSchema', () => {
  it('유효한 입력 통과', () => {
    const result = clubSchema.safeParse({
      name: '서울 테니스클럽',
      city: '서울',
    })
    expect(result.success).toBe(true)
  })

  it('이름 2자 미만 거부', () => {
    const result = clubSchema.safeParse({ name: '가', city: '서울' })
    expect(result.success).toBe(false)
  })

  it('HTML 태그 자동 제거', () => {
    const result = clubSchema.safeParse({
      name: '<script>alert(1)</script>테니스',
      city: '서울',
    })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('alert(1)테니스')
  })
})
```

---

## 요약: tennis-tab에서 가져갈 것 vs 바꿀 것

### 유지 (검증됨)
- 3-Layer 입력 검증 패턴
- 공통 컴포넌트 설계 (Modal, AlertDialog, Toast, Badge)
- DEV 더미 데이터 생성기
- 권한 체계 (레벨 기반)
- 실시간 구독 패턴 (ref 콜백, 디바운스)
- CLAUDE.md 기반 Claude 협업

### 변경
| 항목 | tennis-tab | 다음 프로젝트 |
|------|-----------|-------------|
| 스타일링 | Tailwind CSS | **Bootstrap SCSS 클론** |
| UI 라이브러리 | shadcn/ui (Radix) | **Bootstrap 컴포넌트 클론** |
| 상태 관리 | useState/Context | **Zustand** |
| 폼 관리 | useState + 직접 검증 | **react-hook-form + zod** |
| 워크플로우 | 기능 중심 개발 | **디자인 먼저 → 개발** |
| 컴포넌트 크기 | 40~59KB 비대 | **300줄 이내 원칙** |
