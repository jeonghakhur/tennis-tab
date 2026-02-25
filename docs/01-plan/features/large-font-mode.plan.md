# Plan: 큰글씨 모드 (Large Font Mode)

## 1. 개요

### 1.1 배경
Tennis Tab은 현재 다크/라이트 테마 전환을 지원하지만, 폰트 크기 접근성 옵션이 없다. 테니스 동호인 중 고령 사용자 비율이 높고, 모바일 환경에서 작은 텍스트로 인한 불편함이 있다. 브라우저 기본 확대/축소(Ctrl/Cmd + 휠)는 레이아웃을 깨뜨릴 수 있어, 앱 자체에서 텍스트 크기를 제어하는 기능이 필요하다.

### 1.2 목표
- 사용자가 원하는 폰트 크기를 선택하여 저장할 수 있다
- 기존 레이아웃을 깨지 않으면서 텍스트만 비례 확대된다
- 다크/라이트 테마와 독립적으로 동작하며 동일한 UX 패턴(localStorage + data-attribute)을 따른다

### 1.3 범위

**In Scope:**
- Normal / Large 2단계 폰트 크기 전환
- `FontSizeProvider` 컨텍스트 + `FontSizeToggle` 버튼
- Navigation, AdminHeader에 토글 버튼 배치
- 마이페이지 설정 섹션에 폰트 크기 옵션 추가
- localStorage 영속성 + 시스템 기본값 존중

**Out of Scope (향후):**
- 3단계 이상 크기 단계 (Normal / Large / Extra Large)
- 슬라이더 방식의 연속적 크기 조절
- 사용자 DB 설정 동기화 (로그인 계정에 설정 저장)

---

## 2. 사용자 스토리

| ID | 역할 | 스토리 | 우선순위 |
|----|------|--------|----------|
| US-01 | 비회원/회원 | 상단 네비게이션에서 큰글씨 모드를 켜고 끌 수 있다 | P0 |
| US-02 | 비회원/회원 | 큰글씨 모드 설정이 페이지를 새로고침해도 유지된다 | P0 |
| US-03 | 비회원/회원 | 큰글씨 모드에서 레이아웃이 깨지지 않는다 | P0 |
| US-04 | 회원 | 마이페이지 설정에서 폰트 크기를 변경할 수 있다 | P1 |
| US-05 | ADMIN | 어드민 헤더에서도 동일하게 토글할 수 있다 | P1 |

---

## 3. 기술 설계 방향

### 3.1 구현 접근법: HTML `font-size` 스케일링

기존 `data-theme` 패턴과 동일하게 `html` 요소에 `data-font-size` 속성을 부여하고 CSS로 분기한다.

```css
/* globals.css */
html {
  font-size: 16px; /* 기본값 (Tailwind 기본 기준) */
}

[data-font-size="large"] {
  font-size: 20px; /* 1.25x 배율 */
}
```

**왜 이 방법인가:**
- Tailwind CSS의 `text-sm`, `text-base`, `text-lg` 등은 `rem` 단위 사용 → root `font-size` 변경 시 자동 비례 스케일
- 기존 `data-theme` 패턴과 일관성 유지
- CSS 변수(`--font-scale`)를 사용하는 방법보다 코드 변경 없이 전체 텍스트에 적용 가능

**주의사항:**
- 인라인 `style={{ fontSize: "14px" }}` (px 단위 하드코딩) 텍스트는 스케일 안 됨 → 구현 시 해당 코드 `rem`으로 전환 필요
- `max-w-*`, `w-*`, `h-*` 레이아웃 클래스는 rem 스케일 영향 받을 수 있음 → 레이아웃 검증 필요

### 3.2 폰트 크기 단계

| 모드 | `html` font-size | Tailwind `text-sm` | Tailwind `text-base` | Tailwind `text-lg` |
|------|-----------------|---------------------|----------------------|---------------------|
| Normal | 16px (기본) | 14px | 16px | 18px |
| Large | 20px (1.25×) | 17.5px | 20px | 22.5px |

### 3.3 영속성 전략
- localStorage key: `"font-size"`, 값: `"normal"` | `"large"`
- 기본값: `"normal"` (시스템 font-size preference API 없음)
- ThemeProvider와 마찬가지로 hydration mismatch 방지를 위해 `mounted` 상태 관리

---

## 4. 컴포넌트 구조

```
src/components/
├── ThemeProvider.tsx        # 기존 — 변경 없음
├── ThemeToggle.tsx          # 기존 — 변경 없음
├── FontSizeProvider.tsx     # 신규 — FontSizeContext + Provider
└── FontSizeToggle.tsx       # 신규 — 토글 버튼 (A↕ 아이콘)
```

### 4.1 FontSizeProvider

```typescript
type FontSize = "normal" | "large"

interface FontSizeContextType {
  fontSize: FontSize
  toggleFontSize: () => void
  isLarge: boolean
  mounted: boolean
}
```

- `useEffect`에서 localStorage 읽어 `html`의 `data-font-size` 속성 설정
- `toggleFontSize()`: normal ↔ large 전환 + localStorage 저장 + DOM attribute 업데이트

### 4.2 FontSizeToggle

- `A` 아이콘 또는 "가" 텍스트 버튼 (큰/작은 상태 시각적 표시)
- Navigation의 `<ThemeToggle />` 옆에 배치
- `aria-label="큰글씨 모드 켜기/끄기"`, `aria-pressed={isLarge}`
- 활성 상태: accent 색상 표시

---

## 5. 배치 위치

### 5.1 Navigation (메인 상단 바)
```
[TENNIS TAB] ... [기능] [대회] [클럽] [커뮤니티] | [FontSizeToggle] [ThemeToggle] [UserAvatar]
```

### 5.2 AdminHeader
- 기존 ThemeToggle 옆에 FontSizeToggle 추가

### 5.3 마이페이지 설정 (P1)
- `/my/profile` 또는 `/my/settings` 페이지의 "화면 설정" 섹션에 라디오/토글 옵션 추가

---

## 6. 레이아웃 영향 검토

### 6.1 스케일 시 주의 영역
| 영역 | 영향 | 대응 |
|------|------|------|
| Navigation 로고 텍스트 | 1.25× 확대 → overflow 가능 | `font-size` 클래스 점검 |
| 대진표 매치 카드 | 선수명이 길면 wrap | `truncate` 또는 `min-w` 조정 |
| 테이블 셀 텍스트 | 행 높이 자동 증가 (허용) | 별도 대응 불필요 |
| 모달/다이얼로그 | 폰트 크면 버튼 텍스트 wrap 가능 | `whitespace-nowrap` 검토 |
| `px` 하드코딩 인라인 스타일 | 스케일 안 됨 | `em`/`rem` 또는 Tailwind 클래스로 전환 |

---

## 7. 앱 초기화 변경

### 7.1 `layout.tsx`
```tsx
// before
<ThemeProvider>
  {children}
</ThemeProvider>

// after
<ThemeProvider>
  <FontSizeProvider>
    {children}
  </FontSizeProvider>
</ThemeProvider>
```

---

## 8. 권한 매트릭스

| 기능 | 비회원 | USER | ADMIN |
|------|--------|------|-------|
| 큰글씨 모드 토글 | O | O | O |
| 설정 페이지에서 변경 | — | O | O |

---

## 9. 구현 순서 (권장)

| 순서 | 작업 | 규모 |
|------|------|------|
| 1 | `globals.css`에 `[data-font-size="large"]` CSS 추가 | XS |
| 2 | `FontSizeProvider.tsx` 작성 | S |
| 3 | `FontSizeToggle.tsx` 작성 (아이콘 포함) | S |
| 4 | `layout.tsx`에 `FontSizeProvider` 래핑 | XS |
| 5 | `Navigation.tsx`에 `FontSizeToggle` 배치 | XS |
| 6 | `AdminHeader.tsx`에 `FontSizeToggle` 배치 | XS |
| 7 | 레이아웃 검증 (대진표, 모달, 네비) | S |
| 8 | 인라인 px 폰트 크기 rem 전환 (발견된 케이스만) | S |
| 9 | 마이페이지 설정 섹션 추가 (P1) | M |

---

## 10. 성공 지표

- 큰글씨 모드 ON → 전체 텍스트 1.25× 비례 확대 (px 하드코딩 예외 허용)
- 새로고침 후 설정 유지
- Navigation, 대회 목록, 대진표, 모달에서 레이아웃 깨짐 없음
- ThemeToggle과 독립 동작 (다크+큰글씨, 라이트+큰글씨 모두 정상)
- 키보드로 토글 버튼 접근 + `aria-pressed` 정상 반영
