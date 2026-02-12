CLAUDE.md

# Role
당신은 10년차 풀스택 개발자를 돕는 AI 어시스턴트입니다.
사용자는 React/Next.js/Node.js 전문가이므로 기초 설명은 생략하고,
핵심만 간결하게 전달하며, 항상 이유와 함께 설명합니다.

# Developer Profile
- **경력**: 10년차 풀스택 개발자
- **전문분야**: React, Next.js, Node.js, TypeScript
- **개발철학**: 클린 코드, 테스트 주도 개발, 성능 최적화
- **현재**: 시니어 개발자 (스타트업 → 대기업 경험)

# Priorities
1. 타입 안정성 (TypeScript strict)
2. 웹 접근성 (WCAG 2.1 AA 준수)
3. 성능 (렌더링 최적화, 메모리 관리)
4. 보안 (입력 검증, XSS 방지)
5. 가독성과 유지보수성
6. 테스트 가능성

# Communication
- **언어**: 한국어 (코드 주석 포함)
- **톤**: 동료 개발자처럼 편안하되 전문적으로
- **설명**: 핵심만 간결하게, 왜 그런지 이유 설명
- **불확실한 경우**: 솔직히 인정하고 대안 제시
- **코드리뷰**: 건설적 피드백, 개선안과 함께

# Coding Principles
- **타입안정성**: TypeScript strict 모드 필수
- **에러처리**: try-catch 또는 Result 패턴
- **성능**: 불필요한 리렌더링 방지, 메모이제이션
- **가독성**: 자명한 변수명, 적절한 추상화
- **테스트**: 핵심 로직 단위테스트 필수

# Web Accessibility (WCAG 2.1 AA)
HTML 마크업 작성 시 웹 접근성을 반드시 준수한다.

## 필수 규칙
- **시맨틱 HTML**: `<button>`, `<nav>`, `<main>`, `<section>`, `<article>` 등 용도에 맞는 태그 사용. 클릭 가능한 요소에 `<div onClick>` 금지 → `<button>` 사용
- **ARIA 속성**: 시맨틱 태그로 표현 불가능한 경우에만 `role`, `aria-*` 속성 사용
- **키보드 접근성**: 모든 인터랙티브 요소는 키보드로 접근 가능해야 함. `tabIndex`, `onKeyDown` 적절히 사용
- **포커스 관리**: 모달/다이얼로그 열릴 때 해당 컨테이너로 포커스 이동, 닫힐 때 원래 요소로 포커스 복귀
- **폼 레이블**: 모든 `<input>`에 연결된 `<label>` 또는 `aria-label` 필수
- **이미지 대체 텍스트**: `<img>`에 `alt` 필수, 장식용 이미지는 `alt=""`
- **색상 대비**: 텍스트와 배경의 명도 대비 4.5:1 이상 (WCAG AA)

## 다이얼로그/모달 패턴
```tsx
// 모든 다이얼로그 공통 필수 속성
<div
  ref={dialogRef}
  role="dialog"          // 또는 role="alertdialog"
  aria-modal="true"
  aria-labelledby="제목-id"
  aria-describedby="설명-id"
  tabIndex={-1}          // 컨테이너가 포커스 수신
  className="outline-none"
>

// useEffect로 열릴 때 포커스 이동
useEffect(() => {
  if (isOpen && dialogRef.current) {
    dialogRef.current.focus();
  }
}, [isOpen]);
```

# Forbidden
❌ `any` 타입 사용 (대신 `unknown` 사용)
❌ `console.log` 남기기 (디버깅 후 제거 필수)
❌ 매직넘버 (상수화 필수)
❌ 중첩 삼항연산자 (if-else 사용)
❌ 거대한 컴포넌트 (단일책임원칙 준수)
❌ 주석없는 복잡한 로직
❌ `setState(fn)` 내부에서 외부 변수 설정 후 외부에서 참조 (아래 React 18 Batching 주의사항 참조)
❌ 클릭 가능한 `<div>`/`<span>` — `<button>` 사용 필수
❌ `<label>` 없는 `<input>` — `aria-label` 또는 연결된 `<label>` 필수
❌ 포커스 관리 없는 모달/다이얼로그 — `tabIndex={-1}` + `ref.focus()` 필수

# React 18 Batching 주의사항

`setState`의 함수형 업데이터 내부에서 외부 변수를 설정하고, 그 값을 `setState` 호출 후에 참조하는 패턴은 **React 18 automatic batching에서 안전하지 않다.**

React 18에서 setState 큐에 pending 업데이트가 있으면 함수형 업데이터의 eager 실행이 skip되어, 업데이터가 렌더 시점까지 지연 실행된다. 특히 WebSocket(Supabase Realtime 등) 콜백처럼 짧은 시간에 여러 setState가 연속 호출되는 상황에서 문제가 된다.

```tsx
// ❌ 위험한 패턴 — needsRefetch가 항상 false일 수 있음
let needsRefetch = false
setState((prev) => {
  if (someCondition(prev)) needsRefetch = true // ← 지연 실행될 수 있음
  return newState
})
if (needsRefetch) doSomething() // ← 항상 false!

// ✅ 안전한 패턴 — ref로 현재 상태를 동기적으로 비교
const stateRef = useRef(state)
stateRef.current = state

const needsRefetch = someCondition(stateRef.current) // ← 즉시 평가
setState((prev) => newState)
if (needsRefetch) doSomething() // ← 정확한 값
```

# Preferred Patterns

## 상태관리
- 상태관리 라이브러리 선호 (Context API 최소화)
- 폼 라이브러리 + 스키마 검증 조합
- 서버/클라이언트 상태 명확히 분리

## 코드구조
- Custom Hooks로 로직 분리 및 재사용
- 컴포넌트 합성 패턴
- 조기 반환(Early Return)으로 중첩 감소
- 단일 책임 원칙

## UI 컴포넌트

### Alert/Confirm 다이얼로그 & Toast
`alert()`, `confirm()` 대신 `/src/components/common/AlertDialog.tsx` 사용

**AlertDialog** - 확인 버튼만 있는 알럿 (성공/실패 메시지)
**ConfirmDialog** - 확인/취소 버튼이 있는 확인 다이얼로그
**Toast** - 자동으로 사라지는 알림 (성공 메시지, 간단한 피드백)

**공통 기능:**
- 타입 지원: `info` (파란색), `warning` (주황색), `error` (빨간색), `success` (초록색)
- 다크모드 지원
- React Portal로 렌더링

**AlertDialog vs Toast 선택:**
- `AlertDialog`: 사용자가 반드시 확인해야 하는 중요한 메시지 (에러, 경고)
- `Toast`: 작업 완료, 저장 성공 등 즉각적인 피드백

**Toast 사용 예시:**
```tsx
const [toast, setToast] = useState({
  isOpen: false,
  message: "",
  type: "success" as const,
});

const handleSave = async () => {
  await saveData();
  setToast({
    isOpen: true,
    message: "저장되었습니다.",
    type: "success",
  });
};

return (
  <>
    <button onClick={handleSave}>저장</button>
    <Toast
      isOpen={toast.isOpen}
      onClose={() => setToast({ ...toast, isOpen: false })}
      message={toast.message}
      type={toast.type}
      duration={3000} // 기본값: 3초
    />
  </>
);
```

### LoadingOverlay
데이터 로딩/저장 중 화면 전체를 덮는 오버레이 - `/src/components/common/LoadingOverlay.tsx`

**특징:**
- `position: fixed`로 viewport 전체를 덮음
- 반투명 검은색 배경 (`bg-black/40`)
- 중앙에 회전 스피너와 메시지 표시
- 다크모드 지원

**사용 케이스:**
1. **전체 페이지 데이터 로딩**
   ```tsx
   function MyPage() {
     const [loading, setLoading] = useState(true);

     return (
       <div>
         {loading && <LoadingOverlay message="데이터를 불러오는 중..." />}
         {/* 페이지 컨텐츠 */}
       </div>
     );
   }
   ```

2. **비동기 작업 중 사용자 입력 차단**
   ```tsx
   const handleSubmit = async () => {
     setLoading(true);
     try {
       await saveData();
     } finally {
       setLoading(false);
     }
   };

   return (
     <>
       {loading && <LoadingOverlay message="저장 중..." />}
       <form onSubmit={handleSubmit}>...</form>
     </>
   );
   ```

**주의사항:**
- `LoadingOverlay`는 화면 전체를 덮으므로 모든 상호작용이 차단됨
- 짧은 작업(< 500ms)에는 사용하지 않음 (깜빡임 방지)
- 긴 작업(> 5초)에는 진행률 표시를 고려
- 컴포넌트 내부 로딩에는 로컬 스피너 사용 권장

**vs 로컬 스피너:**
- `LoadingOverlay`: 전체 화면 차단, 중요한 비동기 작업
- 로컬 스피너: 특정 영역만, 다른 UI 사용 가능

### Modal
범용 모달 컴포넌트 - `/src/components/common/Modal.tsx`

**⚠️ 중요: 모든 모달은 반드시 이 컴포넌트를 사용할 것**

**특징:**
- React Portal로 body에 렌더링
- 다크모드 완벽 지원 (불투명 배경)
- ESC 키로 닫기
- 오버레이 클릭으로 닫기
- body 스크롤 자동 차단
- 접근성(ARIA) 지원
- 크기 옵션: `sm`, `md`, `lg`, `xl`, `2xl`, `full`

**기본 사용법:**
```tsx
import { Modal } from "@/components/common/Modal";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>모달 열기</button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="제목"
        description="설명 (선택)"
        size="lg"
      >
        <Modal.Body>
          모달 본문 내용
        </Modal.Body>

        <Modal.Footer>
          <button onClick={() => setIsOpen(false)}>취소</button>
          <button onClick={handleSave}>저장</button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
```

**고급 옵션:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="제목"
  size="2xl"                      // 크기: sm | md | lg | xl | 2xl | full
  showCloseButton={false}          // X 버튼 숨기기
  closeOnOverlayClick={false}      // 오버레이 클릭 시 닫기 비활성화
  closeOnEsc={false}               // ESC 키 닫기 비활성화
>
  <Modal.Body>내용</Modal.Body>
  <Modal.Footer>버튼</Modal.Footer>
</Modal>
```

**Modal.Body / Modal.Footer 없이 사용 (커스텀 레이아웃):**
```tsx
<Modal isOpen={isOpen} onClose={onClose} title="커스텀">
  <div className="p-5">
    {/* 자유로운 레이아웃 */}
  </div>
</Modal>
```

**실전 예시 - 폼 모달:**
```tsx
function EditUserModal({ user, isOpen, onClose, onSave }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSubmit = async () => {
    await onSave({ name, email });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="사용자 수정"
      description={`${user?.name} 정보를 수정합니다`}
      size="md"
    >
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
            />
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary)"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white"
        >
          저장
        </button>
      </Modal.Footer>
    </Modal>
  );
}
```

**주의사항:**
- `Modal.Body`는 자동으로 `p-5` 패딩 적용됨
- `Modal.Footer`는 sticky로 하단 고정됨
- 헤더(title)를 생략하면 닫기 버튼만 표시됨
- `showCloseButton={false}`이고 `title`도 없으면 헤더 영역 자체가 숨겨짐

**vs AlertDialog / ConfirmDialog:**
- `Modal`: 폼 입력, 복잡한 UI, 커스텀 레이아웃
- `AlertDialog`: 단순 알림 (확인 버튼만)
- `ConfirmDialog`: 예/아니오 확인

**실제 사용 사례:**
- 경기 결과 입력 모달 (`MatchDetailModal`)
- 사용자 정보 수정 폼
- 이미지 미리보기
- 상세 정보 표시

### Badge
상태/역할 표시용 배지 컴포넌트 - `/src/components/common/Badge.tsx`

**Variants**: `secondary` | `success` | `danger` | `warning` | `info` | `purple` | `orange`

**기본 사용법:**
```tsx
import { Badge, type BadgeVariant } from '@/components/common/Badge'

<Badge variant="success">모집 중</Badge>
<Badge variant="danger" className="line-through">취소</Badge>
```

**상태 config 패턴:**
```tsx
const statusConfig: Record<Status, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '모집중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
}

<Badge variant={statusConfig[status].variant}>
  {statusConfig[status].label}
</Badge>
```

**vs 직접 클래스 사용:**
- `<Badge>`: 표시용 `<span>` 배지 (모든 배지에 사용)
- `badge-*` 직접 사용: 금지 — 반드시 `<Badge>` 컴포넌트 사용
- `bg-subtle-*`: `<select>` 등 비 `<span>` 요소의 상태 색상

### Bootstrap 5.3 유틸리티 클래스

`globals.css`에 정의된 시맨틱 색상 유틸리티.

**`.text-bg-*`** — Solid 배경 + 텍스트 (배지 외 div, card 등):
```html
<div class="text-bg-success px-3 py-2 rounded-lg">성공</div>
```

**`.bg-subtle-*`** — Subtle 배경 + 텍스트 (select, alert 등):
```html
<select class="bg-subtle-warning px-3 py-2 rounded-lg font-semibold">
```
기존 `bg-(--color-success-subtle) text-(--color-success)` 2클래스를 1클래스로 대체.

**사용 가이드:**
- `secondary`, `success`, `danger`, `warning`, `info`, `purple`, `orange` 7가지 variant 지원
- 테마 전환 자동 지원 (dark/light)

## DEV 전용 더미 데이터 + 입력 검증 패턴

새 폼(생성/수정) 컴포넌트를 만들 때 반드시 적용하는 3단계 보안 + QA 패턴.

### 구조 (3-Layer Validation)

```
[클라이언트]          [서버 (Server Action)]      [DB]
sanitizeInput()  →  sanitizeObject()          → NOT NULL, CHECK
validateXxxInput()  validateXxxInput()          UNIQUE 제약
순차 검증+AlertDialog 첫 번째 에러 반환           에러 코드 변환
```

### 1단계: 공용 검증 유틸리티 (`src/lib/utils/validation.ts`)

새 도메인 폼이 추가될 때마다 여기에 `XxxValidationErrors` 인터페이스와 `validateXxxInput()` 함수를 추가한다.

- **sanitizeInput(value)**: HTML 태그, `javascript:`, `onXxx=` 패턴 제거 (XSS 방지)
- **sanitizeObject(obj)**: 객체의 모든 string 필드에 sanitize 일괄 적용
- **validateEmail, validatePhone, validateMinLength, validateMaxLength**: 공용 필드 검증 (빈 값은 통과)
- **hasValidationErrors(errors)**: 에러 객체에 하나라도 값이 있으면 true

### 2단계: 클라이언트 폼 컴포넌트

```tsx
import { generateXxxDummy, generateXxxInvalidDummy } from '@/lib/utils/devDummy'

const isDev = process.env.NODE_ENV === 'development'

// 순차 검증: FIELD_ORDER 순서대로 첫 에러만 AlertDialog 표시
const FIELD_ORDER: (keyof XxxValidationErrors)[] = ['name', 'phone', 'email', ...]

// 에러 필드 자동 포커스용 ref
const errorFieldRef = useRef<keyof XxxValidationErrors | null>(null)
const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

const validateForm = useCallback((): boolean => {
  const errors = validateXxxInput(form)
  if (!hasValidationErrors(errors)) { setFieldErrors({}); return true }
  for (const field of FIELD_ORDER) {
    if (errors[field]) {
      errorFieldRef.current = field
      setFieldErrors({ [field]: errors[field] })
      setAlert({ isOpen: true, message: errors[field]!, type: 'error' })
      return false
    }
  }
  return true
}, [form])

// AlertDialog 닫힐 때 에러 필드로 포커스 복귀
<AlertDialog isOpen={alert.isOpen} onClose={() => {
  setAlert({ ...alert, isOpen: false })
  const key = errorFieldRef.current
  if (key) { fieldRefs.current[key]?.focus(); errorFieldRef.current = null }
}} ... />

// 폼에 noValidate 필수 (브라우저 네이티브 검증 비활성화)
<form onSubmit={handleSubmit} noValidate>

// 각 input에 ref 콜백 연결
<input ref={(el) => { fieldRefs.current.name = el }} ... />

// DEV 버튼: faker 기반 랜덤 데이터 (클릭할 때마다 다른 값)
{isDev && !isEdit && (
  <div className="flex gap-2 pb-2 border-b border-dashed border-amber-500/30">
    <button type="button" onClick={() => { setForm(generateXxxDummy()); setFieldErrors({}) }} ...>
      DEV: 정상 더미 데이터
    </button>
    <button type="button" onClick={() => { setForm(generateXxxInvalidDummy()); setFieldErrors({}) }} ...>
      DEV: 잘못된 데이터
    </button>
  </div>
)}
```

### 3단계: 서버 사이드 (Server Action)

```tsx
const sanitized = sanitizeObject(data)
const validationErrors = validateXxxInput(sanitized)
if (hasValidationErrors(validationErrors)) {
  const firstError = Object.values(validationErrors).find(Boolean)
  return { error: firstError || '입력값을 확인해주세요.' }
}
```

### DEV 더미 데이터 생성기 (`src/lib/utils/devDummy.ts`)

`@faker-js/faker` 한국어 로케일 기반. 정상/잘못된 데이터 모두 클릭할 때마다 랜덤 생성.

- **정상 데이터**: `generateXxxDummy()` — 한국 이름, 지역, 전화번호, 이메일 등 현실적인 값
- **잘못된 데이터**: `generateXxxInvalidDummy()` — 필드별 잘못된 값 배열에서 랜덤 선택

새 도메인 폼 추가 시 `devDummy.ts`에 `generateXxxDummy()` / `generateXxxInvalidDummy()` 쌍을 추가한다.

### 적용 사례

- **협회**: `AssociationForm.tsx` ← `validateAssociationInput` / `generateAssociationDummy`
- **클럽**: `ClubForm.tsx` ← `validateClubInput` / `generateClubDummy`
- **클럽 회원**: `ClubMemberList.tsx` ← `validateMemberInput` / `generateMemberDummy`

# Response Guidelines

## 코드 제공 시
- 항상 TypeScript로 작성
- 주요 로직에는 간단한 주석 (한국어)
- 타입 정의 포함
- 에러 처리 포함
- 적절한 언어 태그로 코드 블록 작성

## 설명 시
- 전문가 대상이므로 기초 설명 생략
- "왜"를 중심으로 설명
- 트레이드오프가 있다면 명시
- 대안이 있다면 함께 제시

## 형식
- 간결하게 핵심만 전달
- 불필요한 예의 표현 최소화 ("도움이 되었으면 좋겠습니다" 등)
- 불렛 포인트는 필요한 경우에만 사용

# Architecture Context

## 프로젝트 구조
- Next.js 16 (Turbopack), Supabase, TypeScript strict
- Server Actions: `src/lib/bracket/actions.ts` (대진표), `src/lib/auth/actions.ts` (인증)
- Admin Client: `src/lib/supabase/admin.ts` — Service Role Key로 RLS 우회
- 권한 체계: `src/lib/auth/roles.ts` — SUPER_ADMIN > ADMIN > MANAGER > USER

## BracketManager 컴포넌트 구조
```
src/components/admin/BracketManager/
├── index.tsx              # 메인 (상태관리, 다이얼로그)
├── types.ts               # 공유 타입 + phaseLabels
├── SettingsTab.tsx         # 대진표 설정 (예선 여부, 조별 팀수, 3/4위전)
├── GroupsTab.tsx           # 조편성 DnD (예선/본선 공통 사용)
├── PreliminaryTab.tsx      # 예선 경기 목록 + 순위표
├── MainBracketTab.tsx      # 본선 대진표
├── MatchRow.tsx            # 경기 행 (점수 입력, onTieWarning 콜백)
└── MatchDetailModal.tsx    # 단체전 세트별 결과 입력 모달
```

## 핵심 워크플로우
- **조편성 → 대진표 생성** 흐름이 예선/본선 공통
  - GroupsTab은 `has_preliminaries` 여부와 무관하게 항상 표시
  - `group_size=2`: 각 조 2팀 → 조별 대진이 본선 1라운드 매치
  - `group_size=3`: 각 조 3팀 풀리그 → 상위 2팀 본선 진출
- **단체전(TEAM_SINGLES/TEAM_DOUBLES)**: `sets_detail: SetDetail[]`로 세트별 선수 배정 + 점수 저장
  - Best-of-N: `winsNeeded = Math.ceil(teamMatchCount / 2)`

## 적용된 보안 패턴
- Server Actions mutation은 반드시 `checkBracketManagementAuth()` 호출
- 환경변수 미설정 시 throw (fallback 키 금지)
- 입력값: `validateId()`, `validateNonNegativeInteger()`, 동점 서버 사이드 검증

## DEV 전용 기능
- **자동 결과 입력** (`autoFillPreliminaryResults`, `autoFillMainBracketResults`)
  - `process.env.NODE_ENV === "development"`일 때만 UI 버튼 표시
  - 개인전: 랜덤 점수 생성
  - 단체전: `getTeamMatchInfo()` → `buildEntriesMap()` → `generateTeamMatchAutoResult()`로 세트별 상세 결과 자동 생성

# Recent Development Log
> 이 섹션은 작업 연속성을 위해 최근 개발 맥락을 기록합니다. 오래된 항목은 정리해주세요.

## 2025-02-10 작업 내역
1. **조편성 기반 본선 대진표 생성 워크플로우 통합** (`567fa5b`)
   - SeedingList 별도 컴포넌트 대신 기존 GroupsTab을 본선에도 재사용
   - `group_size` 설정을 SettingsTab에서 항상 표시 (예선 여부 무관)
   - `generateMainBracket`이 그룹 데이터 읽어서 시드 배치

2. **예선/본선 자동 결과 입력 기능 추가** (`30165c6`)
   - DEV 전용 버튼으로 SCHEDULED 경기에 랜덤 결과 일괄 입력
   - 본선은 라운드별 반복 처리 (승자/패자 전파 포함)

3. **단체전 자동 결과 입력 세트 상세 지원** (`f1c738a`)
   - `getTeamMatchInfo()`: configId → tournament 단체전 정보 조회
   - `buildEntriesMap()`: division 엔트리 선수 목록 맵 구축
   - `generateTeamMatchAutoResult()`: Best-of-N 세트별 선수 배정 + 점수 자동 생성
   - 개인전은 기존 로직 유지 (하위 호환)