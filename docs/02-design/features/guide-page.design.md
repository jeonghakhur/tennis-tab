# Design: 이용 안내 페이지 (Guide Page)

> Plan: `docs/01-plan/features/guide-page.plan.md`

---

## 1. 파일 구조

```
src/app/guide/
└── page.tsx                        # 서버 컴포넌트 (Static, 인증 불필요)

src/components/guide/
├── GuideSection.tsx                # 섹션 래퍼 (제목 + 소개 + CTA)
├── GuideStep.tsx                   # 단계 아이템 (번호 + 아이콘 + 제목 + 설명)
└── GuideExamples.tsx               # AI 채팅 예시 질문 카드 그리드
```

변경 파일:
- `src/components/Footer.tsx` — '이용 안내' 링크 추가

---

## 2. 페이지 레이아웃

```
┌─────────────────────────────────────────────────────┐
│  헤더                                                │
│  이용 안내                                           │
│  Tennis Tab 주요 기능 사용 방법을 안내합니다.          │
│                                                     │
│  [대회 참가]  [클럽 이용]  [AI 채팅]   ← 앵커 버튼   │
├─────────────────────────────────────────────────────┤
│  Section 1: 대회 참가와 신청          id="tournament" │
│  ─────────────────────────────────────────────────  │
│  소개 문구                                           │
│                                                     │
│  ① 🎾  대회 목록 확인                               │
│      내비게이션 '대회' → 상태 배지로 접수 가능 확인    │
│                                                     │
│  ② 📋  대회 상세 확인                               │
│      일시, 장소, 참가비, 부서, 대회 요강 확인          │
│                                                     │
│  ③ ✍️  참가 신청                                    │
│      우측 '참가 신청' → 부서 선택 → 정보 입력         │
│                                                     │
│  ④ 💳  결제                                         │
│      온라인 결제(카드) 또는 계좌이체                  │
│                                                     │
│  ⑤ 📊  대진표 확인                                  │
│      대회 상세 → '대진표 보기' → 내 경기 일정 확인    │
│                                                     │
│                           [대회 목록 보기 →]          │
├─────────────────────────────────────────────────────┤
│  Section 2: 클럽 이용                  id="club"     │
│  ─────────────────────────────────────────────────  │
│  소개 문구                                           │
│                                                     │
│  ① 🔍  클럽 찾기                                    │
│      내비게이션 '클럽' → 이름/지역 검색               │
│                                                     │
│  ② 🤝  클럽 가입                                    │
│      가입 유형별 안내: 자유·승인제·초대 전용           │
│                                                     │
│  ③ 📅  모임 참석 응답                               │
│      클럽 상세 모임 탭 → 참석/불참/가능 시간 입력      │
│                                                     │
│  ④ 🏸  경기 결과 확인                               │
│      모임 마감 후 대진 배정 → 결과 확인               │
│                                                     │
│  ⑤ 📊  순위 확인                                    │
│      클럽 상세 순위 탭 → 기간별 클럽 내 순위           │
│                                                     │
│                             [클럽 찾기 →]             │
├─────────────────────────────────────────────────────┤
│  Section 3: AI 자연어 검색             id="chat"     │
│  ─────────────────────────────────────────────────  │
│  소개 문구                                           │
│                                                     │
│  ① 💬  채팅창 접근                                  │
│  ② 🔍  대회 검색                                    │
│  ③ 📋  상세 조회                                    │
│  ④ ✍️  참가 신청/취소                               │
│  ⑤ 💡  활용 팁                                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 예시 질문                                     │  │
│  │ 🔍 대회 검색  🏆 결과 조회  📝 신청/취소       │  │
│  │ "이번 주 마포구 대회 뭐 있어?"                  │  │
│  │ "마포구청장기 대진표 보여줘"                    │  │
│  │ "대회 참가 신청하고 싶어"                       │  │
│  └──────────────────────────────────────────────┘  │
│                          [AI 채팅 시작 →]            │
└─────────────────────────────────────────────────────┘
```

---

## 3. 컴포넌트 구현

### 3.1 `src/components/guide/GuideStep.tsx`

```tsx
interface GuideStepProps {
  step: number
  icon: string
  title: string
  children: React.ReactNode
  /** 배경 강조 (짝수 행 구분) — 기본 false */
  alt?: boolean
}

export function GuideStep({ step, icon, title, children, alt = false }: GuideStepProps) {
  return (
    <div
      className={`flex gap-4 p-4 rounded-xl transition-colors ${alt ? 'bg-(--bg-secondary)' : ''}`}
    >
      {/* 스텝 번호 원형 배지 */}
      <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
          aria-label={`${step}단계`}
        >
          {step}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
          <h3
            className="font-semibold text-base"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h3>
        </div>
        <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

---

### 3.2 `src/components/guide/GuideSection.tsx`

```tsx
import Link from 'next/link'

interface GuideSectionProps {
  id: string
  title: string
  description: string
  cta: {
    label: string
    href: string
  }
  children: React.ReactNode
}

export function GuideSection({ id, title, description, cta, children }: GuideSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28"   {/* sticky nav 높이만큼 오프셋 */}
    >
      {/* 섹션 헤더 */}
      <div className="mb-6">
        <h2
          id={`${id}-title`}
          className="text-2xl font-display mb-2 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <span
            className="w-1 h-7 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--accent-color)' }}
            aria-hidden="true"
          />
          {title}
        </h2>
        <p className="text-sm ml-3" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      </div>

      {/* 스텝 목록 */}
      <div className="space-y-1 mb-6">
        {children}
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--bg-primary)',
          }}
        >
          {cta.label}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  )
}
```

---

### 3.3 `src/components/guide/GuideExamples.tsx`

```tsx
/** AI 채팅 예시 질문 카드 그리드 */

interface ExampleGroup {
  category: string
  icon: string
  examples: string[]
}

const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    category: '대회 검색',
    icon: '🔍',
    examples: [
      '지금 신청 가능한 대회 알려줘',
      '다음 달 열리는 테니스 대회 있어?',
      '마포 지역 대회 보여줘',
    ],
  },
  {
    category: '상세 조회',
    icon: '📋',
    examples: [
      '마포구청장기 참가비 얼마야?',
      '내가 신청한 대회 목록 보여줘',
      '다음 내 경기는 언제야?',
    ],
  },
  {
    category: '입상 기록',
    icon: '🏆',
    examples: [
      '최근 우승자 누구야?',
      '올해 대회 입상 기록 보여줘',
      '마포구청장기 대진표 보여줘',
    ],
  },
  {
    category: '신청 / 취소',
    icon: '✍️',
    examples: [
      '대회 참가 신청하고 싶어',
      '신청 취소하고 싶어',
    ],
  },
]

export function GuideExamples() {
  return (
    <div
      className="rounded-2xl p-5 mt-6"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <h4
        className="text-sm font-semibold mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        이렇게 물어보세요
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXAMPLE_GROUPS.map((group) => (
          <div key={group.category}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base" aria-hidden="true">{group.icon}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {group.category}
              </span>
            </div>
            <ul className="space-y-1.5">
              {group.examples.map((ex) => (
                <li
                  key={ex}
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  "{ex}"
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### 3.4 `src/app/guide/page.tsx`

```tsx
import type { Metadata } from 'next'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideStep } from '@/components/guide/GuideStep'
import { GuideExamples } from '@/components/guide/GuideExamples'

export const metadata: Metadata = {
  title: '이용 안내 | Tennis Tab',
  description: 'Tennis Tab 주요 기능 사용 방법 안내: 대회 참가, 클럽 이용, AI 자연어 검색',
}

const SECTIONS = [
  { id: 'tournament', label: '대회 참가' },
  { id: 'club', label: '클럽 이용' },
  { id: 'chat', label: 'AI 채팅' },
] as const

export default function GuidePage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-content mx-auto px-6 py-12">

        {/* 페이지 헤더 */}
        <header className="mb-10">
          <h1
            className="text-3xl font-display mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            이용 안내
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Tennis Tab 주요 기능 사용 방법을 안내합니다.
          </p>
        </header>

        {/* 앵커 네비게이션 */}
        <nav
          aria-label="섹션 이동"
          className="flex flex-wrap gap-2 mb-12 pb-6 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-(--bg-card-hover)"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* 섹션 컨테이너 */}
        <div className="space-y-16">

          {/* ── Section 1: 대회 참가와 신청 ── */}
          <GuideSection
            id="tournament"
            title="대회 참가와 신청"
            description="대회를 찾고, 참가 신청부터 대진표 확인까지 단계별로 안내합니다."
            cta={{ label: '대회 목록 보기', href: '/tournaments' }}
          >
            <GuideStep step={1} icon="🎾" title="대회 목록 확인">
              상단 내비게이션의 <strong>대회</strong>를 클릭하면 전체 대회 목록이 나옵니다.
              대회 카드의 상태 배지로 현재 접수 가능 여부를 확인하세요.
              <ul className="mt-2 space-y-0.5 list-none">
                <li>🟢 <strong>접수중</strong> — 지금 바로 신청 가능</li>
                <li>🟣 <strong>접수 예정</strong> — 접수 기간 전</li>
                <li>🟠 <strong>마감</strong> — 접수 종료</li>
                <li>🔵 <strong>진행중</strong> — 대회 진행 중 (대진표 확인 가능)</li>
              </ul>
            </GuideStep>

            <GuideStep step={2} icon="📋" title="대회 상세 확인" alt>
              대회 카드를 클릭하면 상세 페이지로 이동합니다.
              <strong>대회 일시, 장소, 참가비, 부서별 정보, 대회 요강</strong>을 확인하세요.
              포스터 이미지와 지도도 함께 제공됩니다.
            </GuideStep>

            <GuideStep step={3} icon="✍️" title="참가 신청">
              페이지 우측의 <strong>참가 신청</strong> 버튼을 클릭합니다.
              원하는 부서를 선택하고 이름·연락처 등 필수 정보를 입력하세요.
              복식은 파트너 이름을, 단체전은 팀명과 선수 명단을 추가로 입력합니다.
            </GuideStep>

            <GuideStep step={4} icon="💳" title="결제" alt>
              참가비가 있는 대회는 결제 단계가 진행됩니다.
              <strong>카드 온라인 결제</strong>(토스페이먼츠) 또는 안내된 계좌로 이체 후
              주최측의 확인을 기다리세요. 참가 내역은 <strong>마이페이지 → 내 참가 신청</strong>에서
              확인할 수 있습니다.
            </GuideStep>

            <GuideStep step={5} icon="📊" title="대진표 확인">
              대진표가 생성되면 대회 상세 페이지에 <strong>대진표 보기</strong> 버튼이 나타납니다.
              내 경기 일정과 결과를 실시간으로 확인할 수 있습니다.
            </GuideStep>
          </GuideSection>

          {/* 구분선 */}
          <hr style={{ borderColor: 'var(--border-color)' }} />

          {/* ── Section 2: 클럽 이용 ── */}
          <GuideSection
            id="club"
            title="클럽 이용"
            description="테니스 클럽에 가입하고, 모임 참석부터 순위 확인까지 클럽 기능을 안내합니다."
            cta={{ label: '클럽 찾기', href: '/clubs' }}
          >
            <GuideStep step={1} icon="🔍" title="클럽 찾기">
              상단 내비게이션의 <strong>클럽</strong>을 클릭합니다.
              클럽 이름으로 검색하거나 지역(시도)으로 필터링해 원하는 클럽을 찾아보세요.
              내가 가입한 클럽은 목록 상단에 표시됩니다.
            </GuideStep>

            <GuideStep step={2} icon="🤝" title="클럽 가입" alt>
              클럽 카드의 가입 유형 배지를 확인하세요.
              <ul className="mt-2 space-y-0.5 list-none">
                <li>🟢 <strong>자유 가입</strong> — 클릭 즉시 가입</li>
                <li>🟡 <strong>승인제</strong> — 자기소개를 작성 후 임원 승인 대기</li>
                <li>⚫ <strong>초대 전용</strong> — 클럽 임원의 초대로만 가입 가능</li>
              </ul>
            </GuideStep>

            <GuideStep step={3} icon="📅" title="모임 참석 응답">
              클럽 상세 페이지의 <strong>모임 탭</strong>에서 예정된 모임을 확인합니다.
              모임을 선택한 후 <strong>참석 / 불참 / 가능 시간</strong>을 응답해두세요.
              모임 마감 전까지 응답을 수정할 수 있습니다.
            </GuideStep>

            <GuideStep step={4} icon="🏸" title="경기 결과 확인" alt>
              모임이 마감되면 임원이 참석자를 기반으로 대진을 배정합니다.
              모임 상세 페이지 하단 <strong>대진표</strong>에서 나의 경기 상대와 결과를 확인하세요.
            </GuideStep>

            <GuideStep step={5} icon="📊" title="순위 확인">
              클럽 상세 페이지의 <strong>순위 탭</strong>에서 클럽 내 종합 순위를 확인합니다.
              기간(전체·1개월·3개월·6개월)과 경기 방식(단식·복식)별로 필터링할 수 있습니다.
            </GuideStep>
          </GuideSection>

          {/* 구분선 */}
          <hr style={{ borderColor: 'var(--border-color)' }} />

          {/* ── Section 3: AI 자연어 검색 ── */}
          <GuideSection
            id="chat"
            title="AI 자연어 검색"
            description="말하듯이 입력하면 AI가 대회 정보를 찾아주고 참가 신청까지 도와줍니다."
            cta={{ label: 'AI 채팅 시작', href: '/' }}
          >
            <GuideStep step={1} icon="💬" title="채팅창 접근">
              상단 로고 <strong>TENNIS TAB</strong>을 클릭하거나 메인 페이지로 이동하면
              채팅 인터페이스가 나타납니다. 하단 입력창에 궁금한 것을 자유롭게 입력하세요.
              <strong>로그인</strong>이 필요합니다.
            </GuideStep>

            <GuideStep step={2} icon="🔍" title="대회 검색" alt>
              자연어로 원하는 조건을 입력하면 AI가 대회를 찾아줍니다.
              지역, 날짜, 상태 등 다양한 조건을 조합할 수 있습니다.
              예: <em>"이번 주 마포구 대회 뭐 있어?"</em>, <em>"6월에 열리는 대회 알려줘"</em>
            </GuideStep>

            <GuideStep step={3} icon="📋" title="상세 조회">
              특정 대회 이름을 언급하면 요강, 참가비, 부서, 대진표, 경기 결과 등
              상세 정보를 바로 확인할 수 있습니다.
              내 신청 내역이나 다음 경기 일정도 물어볼 수 있습니다.
            </GuideStep>

            <GuideStep step={4} icon="✍️" title="참가 신청 / 취소" alt>
              <em>"대회 참가 신청하고 싶어"</em>라고 입력하면 AI가 단계별로 안내합니다.
              대회 선택 → 부서 선택 → 전화번호 입력 → 확인 순으로 진행됩니다.
              <em>"신청 취소하고 싶어"</em>로 취소 플로우도 시작할 수 있습니다.
            </GuideStep>

            <GuideStep step={5} icon="💡" title="활용 팁">
              플로우 중에 <strong>"취소"</strong> 또는 <strong>"그만"</strong>을 입력하면
              언제든지 진행을 중단할 수 있습니다.
              새로운 질문을 입력하면 진행 중이던 플로우가 자동으로 초기화됩니다.
            </GuideStep>
          </GuideSection>

          {/* AI 예시 질문 */}
          <GuideExamples />

        </div>
      </div>
    </div>
  )
}
```

---

## 4. Footer 수정

### `src/components/Footer.tsx`

기존 링크 목록에 `이용 안내` 추가 (고객센터와 이용약관 사이):

```tsx
{/* 변경 전 */}
<Link href="/support" ...>고객센터</Link>
<Link href="/terms" ...>이용약관</Link>

{/* 변경 후 */}
<Link href="/support" ...>고객센터</Link>
<Link href="/guide" ...>이용 안내</Link>
<Link href="/terms" ...>이용약관</Link>
```

---

## 5. 구현 순서

| # | 작업 | 파일 | 비고 |
|---|------|------|------|
| 1 | GuideStep 컴포넌트 | `src/components/guide/GuideStep.tsx` | 의존성 없음 |
| 2 | GuideSection 컴포넌트 | `src/components/guide/GuideSection.tsx` | 의존성 없음 |
| 3 | GuideExamples 컴포넌트 | `src/components/guide/GuideExamples.tsx` | 의존성 없음 |
| 4 | 가이드 페이지 | `src/app/guide/page.tsx` | #1, #2, #3 필요 |
| 5 | Footer 링크 추가 | `src/components/Footer.tsx` | #4 완료 후 |

---

## 6. 설계 결정

### 6.1 Server Component (Static)

DB 연동·인증이 없는 완전한 정적 페이지. Next.js 빌드 시 HTML로 생성되어 CDN 캐싱 가능. 별도 `export const revalidate` 없이 기본 static export 사용.

### 6.2 단일 페이지 스크롤 vs 탭

탭 방식은 URL로 직접 섹션 공유가 불가하다. 앵커(`#tournament`, `#club`, `#chat`) 방식으로 각 섹션을 개별 링크로 공유 가능하게 설계. `scroll-mt-28`로 sticky nav 높이 오프셋.

### 6.3 GuideExamples 별도 컴포넌트

현재는 정적 렌더링이지만, 향후 클립보드 복사 기능(`navigator.clipboard`) 추가 시 `'use client'`로 전환 가능하도록 분리.

### 6.4 콘텐츠 하드코딩

FAQ와 달리 이용 안내 콘텐츠는 서비스 흐름 자체이므로 DB 관리 불필요. 수정 빈도가 낮고, 변경 시 코드 배포가 적절한 수준.

### 6.5 접근성

- `<section id>` + `aria-labelledby` 조합으로 화면 낭독기 지원
- 스텝 번호 `aria-label="N단계"` 명시
- 앵커 `<nav aria-label="섹션 이동">`
- 이모지에 `aria-hidden="true"` 적용
