# Design: 큰글씨 모드 (Large Font Mode)

> Plan 참조: `docs/01-plan/features/large-font-mode.plan.md`

---

## 1. 구현 전략

### 1.1 CSS 메커니즘

`document.documentElement`(`html` 요소)에 `data-font-size` 속성을 부여하고, CSS에서 선택자로 분기. 기존 `data-theme` 패턴과 완전히 동일한 구조.

```css
/* globals.css — html 블록 추가 */
html {
  font-size: 16px; /* Tailwind rem 기준값 명시 */
}

[data-font-size="large"] {
  font-size: 20px; /* 1.25× 배율 */
}
```

**rem 스케일 영향 범위:**

| Tailwind 클래스 | Normal (16px) | Large (20px) |
|----------------|--------------|--------------|
| `text-xs` | 12px | 15px |
| `text-sm` | 14px | 17.5px |
| `text-base` | 16px | 20px |
| `text-lg` | 18px | 22.5px |
| `text-xl` | 20px | 25px |
| `text-2xl` | 24px | 30px |
| `p-4` (1rem) | 16px | 20px |
| `w-10` (2.5rem) | 40px | 50px |

> **패딩/크기도 같이 스케일되는 점 인지**: 레이아웃이 깨지는 게 아니라 전체가 비례 확대되므로, 대부분의 케이스에서 자연스러운 결과임. 문제가 생기는 특정 요소는 `!text-[14px]` 등 Tailwind arbitrary value로 고정 가능.

### 1.2 FOUC 방지

ThemeProvider가 `visibility: hidden` 으로 children을 감싸기 때문에, FontSizeProvider의 `useEffect`가 실행되어 `data-font-size`를 설정한 뒤 ThemeProvider가 visible로 전환됨 → 추가 FOUC 방지 로직 불필요.

### 1.3 인라인 px 폰트 감사 결과

사전 조사 결과, `src/` 내 `fontSize: "...px"` 형태의 인라인 스타일은 없음. 구현 중 발견 시 즉시 Tailwind 클래스 또는 `rem` 단위로 전환.

---

## 2. 신규 파일

### 2.1 `src/components/FontSizeProvider.tsx`

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type FontSize = "normal" | "large";

interface FontSizeContextType {
  fontSize: FontSize;
  toggleFontSize: () => void;
  isLarge: boolean;
  mounted: boolean;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(
  undefined
);

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("font-size") as FontSize | null;
      // "large"만 유효값 — 그 외 모든 값(null, 오염된 값)은 "normal" 처리
      const initial: FontSize = saved === "large" ? "large" : "normal";
      setFontSizeState(initial);
      document.documentElement.setAttribute("data-font-size", initial);
    } catch {
      // localStorage 접근 불가 환경 (보안 정책 등)
      document.documentElement.setAttribute("data-font-size", "normal");
    } finally {
      setMounted(true);
    }
  }, []);

  const applyFontSize = (size: FontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem("font-size", size);
    } catch {
      // 무시 — DOM 반영만으로 충분
    }
    document.documentElement.setAttribute("data-font-size", size);
  };

  const toggleFontSize = () => {
    applyFontSize(fontSize === "normal" ? "large" : "normal");
  };

  return (
    <FontSizeContext.Provider
      value={{ fontSize, toggleFontSize, isLarge: fontSize === "large", mounted }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}
```

### 2.2 `src/components/FontSizeToggle.tsx`

```tsx
"use client";

import { useFontSize } from "./FontSizeProvider";

export function FontSizeToggle() {
  const { isLarge, toggleFontSize } = useFontSize();

  return (
    <button
      type="button"
      onClick={toggleFontSize}
      className="relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/10"
      aria-label={isLarge ? "기본 글씨 크기로 변경" : "큰 글씨 모드로 변경"}
      aria-pressed={isLarge}
      title={isLarge ? "기본 글씨" : "큰 글씨"}
    >
      {/* 'Normal' 상태: 작은 '가' */}
      <span
        aria-hidden="true"
        className="select-none font-display font-bold leading-none transition-all duration-300"
        style={{
          fontSize: "14px",      // px 고정 — 버튼 자체가 이미 스케일됨
          opacity: isLarge ? 0 : 1,
          transform: isLarge ? "scale(0.7)" : "scale(1)",
          position: "absolute",
          color: "var(--text-secondary)",
        }}
      >
        가
      </span>

      {/* 'Large' 상태: 큰 '가' + accent 색상 */}
      <span
        aria-hidden="true"
        className="select-none font-display font-bold leading-none transition-all duration-300"
        style={{
          fontSize: "18px",      // px 고정
          opacity: isLarge ? 1 : 0,
          transform: isLarge ? "scale(1)" : "scale(0.7)",
          position: "absolute",
          color: "var(--accent-color)",
        }}
      >
        가
      </span>
    </button>
  );
}
```

---

## 3. 기존 파일 수정

### 3.1 `src/app/globals.css`

```css
/* 기존 html {} 블록 없음 → scroll-behavior 아래에 추가 */
html {
  scroll-behavior: smooth;
  font-size: 16px;            /* ← 추가: Tailwind rem 기준 명시 */
}

/* [data-theme="dark"] 블록 위에 추가 */
[data-font-size="large"] {
  font-size: 20px;
}
```

> 실제 변경: 기존 `html { scroll-behavior: smooth; }` 한 줄짜리 블록에 `font-size: 16px;` 추가 + `[data-font-size="large"]` 블록 신규 추가.

### 3.2 `src/app/layout.tsx`

```diff
  import { ThemeProvider } from "@/components/ThemeProvider";
+ import { FontSizeProvider } from "@/components/FontSizeProvider";

  export default function RootLayout({ children }) {
    return (
      <html lang="ko" data-scroll-behavior="smooth">
        <body className="font-body antialiased min-h-screen flex flex-col">
          <ThemeProvider>
+           <FontSizeProvider>
              <AuthProvider>
                <Navigation />
                <main className="flex-1 flex flex-col pt-20">
                  {children}
                </main>
                <Footer />
              </AuthProvider>
+           </FontSizeProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }
```

### 3.3 `src/components/Navigation.tsx`

```diff
  import { ThemeToggle } from './ThemeToggle'
+ import { FontSizeToggle } from './FontSizeToggle'

  <div className="flex items-center gap-4">
+   <FontSizeToggle />
    <ThemeToggle />
    {loading ? ( ...
```

### 3.4 `src/components/admin/AdminHeader.tsx`

```diff
  import { useTheme } from '@/components/ThemeProvider'
+ import { useFontSize } from '@/components/FontSizeProvider'
  import { Sun, Moon, Bell } from 'lucide-react'

  export function AdminHeader(...) {
    const { theme, toggleTheme } = useTheme()
+   const { isLarge, toggleFontSize } = useFontSize()

    return (
      <div className="flex items-center gap-4">
+       {/* 큰글씨 토글 */}
+       <button
+         type="button"
+         onClick={toggleFontSize}
+         className="p-2 rounded-lg hover:bg-(--bg-card) transition-colors"
+         title={isLarge ? "기본 글씨" : "큰 글씨"}
+         aria-label={isLarge ? "기본 글씨 크기로 변경" : "큰 글씨 모드로 변경"}
+         aria-pressed={isLarge}
+       >
+         <span
+           className="font-display font-bold"
+           style={{
+             fontSize: isLarge ? "18px" : "14px",
+             color: isLarge ? "var(--accent-color)" : "var(--text-secondary)",
+           }}
+         >
+           가
+         </span>
+       </button>

        {/* 기존 Theme Toggle */}
        <button onClick={toggleTheme} ...>
```

### 3.5 `src/app/my/profile/page.tsx` — 화면 설정 섹션 (P1)

프로필 페이지 하단에 "화면 설정" 카드 섹션 추가.

```tsx
// 컴포넌트 상단
import { useFontSize } from "@/components/FontSizeProvider";

// 컴포넌트 내부
const { isLarge, toggleFontSize } = useFontSize();

// JSX — 기존 프로필 카드 아래에 추가
<div className="glass-card p-6 mt-6">
  <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
    화면 설정
  </h2>
  <div className="flex items-center justify-between py-3 border-b border-(--border-color)">
    <div>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        큰 글씨 모드
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        텍스트를 1.25배 크게 표시합니다
      </p>
    </div>
    {/* 토글 스위치 */}
    <button
      type="button"
      role="switch"
      aria-checked={isLarge}
      onClick={toggleFontSize}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-color) ${
        isLarge ? "bg-(--accent-color)" : "bg-(--border-color)"
      }`}
    >
      <span className="sr-only">큰 글씨 모드</span>
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${
          isLarge ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
</div>
```

---

## 4. 파일 변경 요약

| 파일 | 유형 | 변경 내용 |
|------|------|-----------|
| `src/components/FontSizeProvider.tsx` | 신규 | Context + Provider |
| `src/components/FontSizeToggle.tsx` | 신규 | 네비게이션용 토글 버튼 |
| `src/app/globals.css` | 수정 | `html { font-size: 16px }` + `[data-font-size="large"]` |
| `src/app/layout.tsx` | 수정 | FontSizeProvider 래핑 |
| `src/components/Navigation.tsx` | 수정 | FontSizeToggle 배치 |
| `src/components/admin/AdminHeader.tsx` | 수정 | 큰글씨 토글 버튼 추가 |
| `src/app/my/profile/page.tsx` | 수정 (P1) | 화면 설정 섹션 추가 |

---

## 5. 레이아웃 검증 체크리스트

구현 후 아래 항목을 Large 모드에서 직접 확인:

- [ ] Navigation 로고/메뉴 텍스트 — overflow 없음, 모바일에서도 정상
- [ ] 대회 목록 카드 — 제목/날짜 wrap 허용, 잘림(clip) 없음
- [ ] 대진표 매치 카드 — 선수명 `truncate` 적용 여부 확인
- [ ] Modal, AlertDialog, Toast — 버튼 텍스트 wrap 여부 확인
- [ ] 어드민 사이드바 메뉴 — 항목 이름 잘림 없음
- [ ] 테이블 헤더/셀 — 줄바꿈 허용, 가로 스크롤 없음

---

## 6. 구현 순서

| # | 작업 | 파일 |
|---|------|------|
| 1 | CSS 추가 | `globals.css` |
| 2 | FontSizeProvider 작성 | `FontSizeProvider.tsx` |
| 3 | FontSizeToggle 작성 | `FontSizeToggle.tsx` |
| 4 | layout.tsx 래핑 | `layout.tsx` |
| 5 | Navigation에 토글 배치 | `Navigation.tsx` |
| 6 | AdminHeader에 토글 배치 | `AdminHeader.tsx` |
| 7 | 레이아웃 검증 | — |
| 8 | 마이페이지 화면 설정 섹션 | `my/profile/page.tsx` |
