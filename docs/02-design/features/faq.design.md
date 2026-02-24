# Design: 자주하는 질문 (FAQ)

> Plan: `docs/01-plan/features/faq.plan.md`

---

## 1. DB 마이그레이션

### 파일: Supabase Migration (MCP apply_migration으로 적용)

```sql
-- ============================================================================
-- faqs (자주하는 질문)
-- ============================================================================
CREATE TABLE faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('ACCOUNT', 'TOURNAMENT', 'CLUB', 'COMMUNITY')),
  question text NOT NULL CHECK (char_length(question) <= 200),
  answer text NOT NULL CHECK (char_length(answer) <= 2000),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE faqs IS '자주하는 질문 (FAQ)';

-- 카테고리별 정렬 조회
CREATE INDEX idx_faqs_category_sort ON faqs(category, sort_order);

-- RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- SELECT: 전체 허용
CREATE POLICY "faqs_select_all" ON faqs
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Admin Client(Service Role Key)로만 수행하므로 별도 정책 불필요
-- Server Action에서 createAdminClient() 사용

-- ============================================================================
-- 초기 FAQ 데이터 시딩
-- ============================================================================
INSERT INTO faqs (category, question, answer, sort_order) VALUES
-- 회원/계정
('ACCOUNT', '회원가입은 어떻게 하나요?', '카카오, 구글, 네이버 계정으로 간편하게 가입하실 수 있습니다. 로그인 페이지에서 원하시는 소셜 계정을 선택해주세요. 첫 로그인 시 이름, 연락처 등 프로필 정보를 설정하실 수 있습니다.', 1),
('ACCOUNT', '다른 소셜 계정으로 변경할 수 있나요?', '현재는 처음 가입한 소셜 계정으로만 로그인이 가능합니다. 변경이 필요하신 경우 고객센터 1:1 문의로 요청해주세요.', 2),
('ACCOUNT', '프로필 정보를 수정하고 싶어요', '로그인 후 우측 상단 메뉴에서 "마이페이지"에 들어가시면 프로필 수정이 가능합니다. 이름, 연락처 등을 변경하실 수 있어요.', 3),
('ACCOUNT', '회원 탈퇴는 어떻게 하나요?', '마이페이지의 "프로필 수정" 하단에 회원 탈퇴 버튼이 있습니다. 탈퇴 시 이메일 주소를 한 번 더 입력하여 확인하시면 처리됩니다. 탈퇴하면 모든 개인 정보가 삭제되며 되돌릴 수 없으니 신중하게 결정해주세요.', 4),
('ACCOUNT', '점수는 어떻게 입력하나요?', '마이페이지의 프로필 수정에서 본인의 점수를 직접 입력하실 수 있습니다. 점수 체계와 기준에 대해서는 커뮤니티의 대회 규칙 게시글을 참고해주세요.', 5),
-- 대회
('TOURNAMENT', '대회에 참가하려면 어떻게 하나요?', '상단 메뉴의 "대회"를 눌러 대회 목록을 확인하세요. 모집 중인 대회를 선택한 뒤, 참가할 부별을 골라 신청하시면 됩니다.', 1),
('TOURNAMENT', '대회 참가 신청을 취소하고 싶어요', '해당 대회 상세 페이지에서 내 참가 현황을 확인하신 뒤 취소할 수 있습니다. 단, 모집이 마감된 이후에는 취소가 어려울 수 있으니 참고해주세요.', 2),
('TOURNAMENT', '대진표는 어디서 확인할 수 있나요?', '대회 상세 페이지의 "대진표" 탭에서 확인하실 수 있습니다. 경기 진행 중에는 실시간으로 결과가 반영됩니다.', 3),
('TOURNAMENT', '대회 결과는 어디서 볼 수 있나요?', '대회 상세 페이지의 대진표에서 모든 경기 결과를 확인하실 수 있습니다. 종료된 대회도 동일하게 조회 가능합니다.', 4),
('TOURNAMENT', '단체전과 개인전의 차이가 뭔가요?', '개인전은 1명(단식) 또는 2명(복식)이 한 팀으로 참가합니다. 단체전은 여러 명이 팀을 이루어 참가하며, 각 세트마다 출전 선수를 배정하는 방식으로 진행됩니다.', 5),
('TOURNAMENT', '예선과 본선은 어떻게 진행되나요?', '예선은 조별 풀리그 방식으로 진행되며, 각 조의 상위 팀이 본선에 진출합니다. 본선은 토너먼트(패자 탈락) 방식으로 진행되어 최종 우승자를 가립니다.', 6),
-- 클럽
('CLUB', '클럽에 가입하려면 어떻게 하나요?', '상단 메뉴의 "클럽"에서 클럽 목록을 확인하세요. 원하는 클럽을 선택하고 가입 신청을 하시면, 해당 클럽의 회장 또는 총무가 승인한 뒤 가입이 완료됩니다.', 1),
('CLUB', '클럽을 새로 만들 수 있나요?', '현재는 관리자를 통해 클럽을 생성할 수 있습니다. 고객센터의 1:1 문의로 클럽명, 활동 지역 등의 정보와 함께 요청해주세요.', 2),
('CLUB', '클럽 역할(회장, 총무, 회원)이 뭔가요?', '회장은 클럽의 대표로서 전체 관리 권한을 가지고 있습니다. 총무는 회장을 도와 회원 관리를 담당하며, 회원은 클럽에 소속된 일반 멤버입니다.', 3),
('CLUB', '클럽 탈퇴는 어떻게 하나요?', '상단 메뉴의 "클럽"에서 탈퇴하려는 클럽의 상세 페이지에 들어가시면 "탈퇴하기" 버튼이 있습니다. 단, 클럽 회장(소유자)은 바로 탈퇴할 수 없으며, 소유권을 이전하거나 클럽을 삭제해야 합니다.', 4),
('CLUB', '소속 클럽을 여러 개 가입할 수 있나요?', '네, 여러 클럽에 동시에 가입하실 수 있습니다. 각 클럽의 활동은 독립적으로 관리됩니다.', 5),
-- 커뮤니티
('COMMUNITY', '게시글은 누구나 작성할 수 있나요?', '게시글 작성은 협회에서 지정한 운영진만 가능합니다. 댓글은 로그인한 회원이라면 누구나 작성하실 수 있어요.', 1),
('COMMUNITY', '게시글에 이미지를 첨부할 수 있나요?', '네, 글 작성 시 에디터에서 이미지를 삽입하거나 파일을 첨부할 수 있습니다.', 2),
('COMMUNITY', '부적절한 게시글/댓글을 신고하고 싶어요', '고객센터의 1:1 문의를 통해 해당 게시글이나 댓글을 알려주세요. 관리자가 확인 후 적절한 조치를 취하겠습니다.', 3);
```

---

## 2. 타입 정의

### 파일: `src/lib/faq/types.ts`

```ts
/** FAQ 카테고리 */
export type FaqCategory = 'ACCOUNT' | 'TOURNAMENT' | 'CLUB' | 'COMMUNITY'

/** 카테고리 한국어 레이블 */
export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  ACCOUNT: '회원/계정',
  TOURNAMENT: '대회',
  CLUB: '클럽',
  COMMUNITY: '커뮤니티',
}

/** 카테고리 표시 순서 */
export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  'ACCOUNT',
  'TOURNAMENT',
  'CLUB',
  'COMMUNITY',
]

/** FAQ 항목 */
export interface Faq {
  id: string
  category: FaqCategory
  question: string
  answer: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/** FAQ 생성/수정 입력 */
export interface FaqInput {
  category: FaqCategory
  question: string
  answer: string
  sort_order?: number
  is_active?: boolean
}
```

---

## 3. Server Actions

### 파일: `src/lib/faq/actions.ts`

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/supabase/types'
import type { Faq, FaqInput, FaqCategory } from './types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateFaqInput(data: FaqInput): string | null {
  if (!data.category) return '카테고리를 선택해주세요.'
  if (!data.question?.trim()) return '질문을 입력해주세요.'
  if (data.question.length > 200) return '질문은 200자 이내로 입력해주세요.'
  if (!data.answer?.trim()) return '답변을 입력해주세요.'
  if (data.answer.length > 2000) return '답변은 2000자 이내로 입력해주세요.'
  return null
}

async function checkAdminAuth(): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinimumRole(profile.role as UserRole, 'ADMIN')) {
    return { error: '관리자 권한이 필요합니다.' }
  }
  return {}
}

// ============================================================================
// 사용자용 (공개)
// ============================================================================

/** 활성 FAQ 전체 조회 (카테고리별 정렬) */
export async function getFaqs(): Promise<{ data: Faq[]; error?: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as Faq[] }
}

// ============================================================================
// 어드민용
// ============================================================================

/** FAQ 전체 조회 (비활성 포함) */
export async function getFaqsAdmin(): Promise<{ data: Faq[]; error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: [], error: auth.error }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as Faq[] }
}

/** FAQ 생성 */
export async function createFaq(
  input: FaqInput
): Promise<{ data: Faq | null; error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: null, error: auth.error }

  const validationError = validateFaqInput(input)
  if (validationError) return { data: null, error: validationError }

  const supabase = createAdminClient()

  // sort_order 미지정 시 해당 카테고리의 마지막 순서 + 1
  let sortOrder = input.sort_order ?? 0
  if (!input.sort_order) {
    const { data: maxRow } = await supabase
      .from('faqs')
      .select('sort_order')
      .eq('category', input.category)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    sortOrder = (maxRow?.sort_order ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('faqs')
    .insert({
      category: input.category,
      question: input.question.trim(),
      answer: input.answer.trim(),
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/support')
  revalidatePath('/admin/faq')
  return { data: data as Faq }
}

/** FAQ 수정 */
export async function updateFaq(
  id: string,
  input: Partial<FaqInput>
): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!id) return { error: '유효하지 않은 FAQ ID입니다.' }

  // 부분 수정이므로 question/answer가 있을 때만 검증
  if (input.question !== undefined) {
    if (!input.question.trim()) return { error: '질문을 입력해주세요.' }
    if (input.question.length > 200) return { error: '질문은 200자 이내로 입력해주세요.' }
  }
  if (input.answer !== undefined) {
    if (!input.answer.trim()) return { error: '답변을 입력해주세요.' }
    if (input.answer.length > 2000) return { error: '답변은 2000자 이내로 입력해주세요.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('faqs')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/support')
  revalidatePath('/admin/faq')
  return {}
}

/** FAQ 삭제 */
export async function deleteFaq(id: string): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!id) return { error: '유효하지 않은 FAQ ID입니다.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('faqs').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/support')
  revalidatePath('/admin/faq')
  return {}
}

/** FAQ 활성/비활성 토글 */
export async function toggleFaqActive(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  return updateFaq(id, { is_active: isActive } as Partial<FaqInput>)
}
```

---

## 4. 사용자 컴포넌트

### 4.1 파일: `src/components/faq/FaqSection.tsx`

고객센터 페이지에 삽입되는 FAQ 영역. 카테고리 탭 + 검색 + 아코디언.

```tsx
'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { Faq, FaqCategory } from '@/lib/faq/types'
import { FAQ_CATEGORY_LABELS, FAQ_CATEGORY_ORDER } from '@/lib/faq/types'

interface FaqSectionProps {
  faqs: Faq[]
}

export function FaqSection({ faqs }: FaqSectionProps) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>(FAQ_CATEGORY_ORDER[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // 검색 필터링
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let result = faqs

    if (q) {
      // 검색 시 전체 카테고리에서 필터
      result = faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q)
      )
    } else {
      // 검색 없으면 선택 카테고리만
      result = faqs.filter((faq) => faq.category === activeCategory)
    }

    return result
  }, [faqs, activeCategory, searchQuery])

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <h2 className="text-2xl font-display mb-6" style={{ color: 'var(--text-primary)' }}>
        자주하는 질문
      </h2>

      {/* 검색 */}
      <div className="relative mb-5">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="질문을 검색하세요"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none text-sm
                     focus:ring-2 focus:ring-(--accent-color)/30"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          aria-label="FAQ 검색"
        />
      </div>

      {/* 카테고리 탭 (검색 중에는 숨김) */}
      {!searchQuery && (
        <div
          className="flex gap-1 mb-5 border-b overflow-x-auto"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="FAQ 카테고리"
        >
          {FAQ_CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => { setActiveCategory(cat); setOpenId(null) }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                ${activeCategory === cat ? 'border-b-2' : ''}`}
              style={{
                borderColor: activeCategory === cat ? 'var(--accent-color)' : 'transparent',
                color: activeCategory === cat ? 'var(--accent-color)' : 'var(--text-muted)',
              }}
            >
              {FAQ_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* 아코디언 리스트 */}
      {filteredFaqs.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
          {searchQuery ? '검색 결과가 없습니다.' : '등록된 질문이 없습니다.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {/* 질문 (버튼) */}
              <button
                onClick={() => handleToggle(faq.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-(--bg-card-hover)"
                style={{ color: 'var(--text-primary)' }}
                aria-expanded={openId === faq.id}
                aria-controls={`faq-answer-${faq.id}`}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200
                    ${openId === faq.id ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--text-muted)' }}
                />
              </button>

              {/* 답변 */}
              <div
                id={`faq-answer-${faq.id}`}
                role="region"
                className={`overflow-hidden transition-all duration-200
                  ${openId === faq.id ? 'max-h-96' : 'max-h-0'}`}
              >
                <div
                  className="px-4 pb-4 text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 4.2 고객센터 페이지 재구성: `src/app/support/page.tsx`

```
레이아웃 구성:
┌─────────────────────────────────┐
│          고객센터 헤더           │
├─────────────────────────────────┤
│                                 │
│    FAQ 섹션 (FaqSection)        │
│    - 검색                       │
│    - 카테고리 탭                │
│    - 아코디언 리스트            │
│                                 │
├─────────────────────────────────┤
│  "원하는 답변을 찾지 못하셨나요?"  │
│  [1:1 문의하기]  [내 문의 내역]   │
└─────────────────────────────────┘
```

주요 변경:
- FAQ 데이터를 Server Component에서 `getFaqs()` 호출하여 SSR
- 기존 카드 2개(문의, 내역)를 하단으로 이동
- FAQ 섹션 → 구분선 → "답변을 찾지 못하셨나요?" 유도 문구 → 문의 카드

```tsx
// 페이지를 Server Component + Client Component 조합으로 변경
// Server 측에서 FAQ 데이터 fetch → FaqSection에 props 전달

import { getFaqs } from '@/lib/faq/actions'
import { FaqSection } from '@/components/faq/FaqSection'
// ... 기존 문의 카드 로직은 별도 Client Component로 분리

export default async function SupportPage() {
  const { data: faqs } = await getFaqs()

  return (
    <main>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1>고객센터</h1>
          <p>무엇을 도와드릴까요?</p>
        </div>

        {/* FAQ 섹션 */}
        <FaqSection faqs={faqs} />

        {/* 유도 문구 + 문의 카드 */}
        <div className="mt-12 pt-8 border-t text-center">
          <p className="mb-6">원하는 답변을 찾지 못하셨나요?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* 1:1 문의하기 카드 */}
            {/* 내 문의 내역 카드 */}
          </div>
        </div>
      </div>
    </main>
  )
}
```

---

## 5. 어드민 컴포넌트

### 5.1 파일: `src/app/admin/faq/page.tsx`

FAQ 관리 페이지. 기존 어드민 페이지 패턴을 따름.

```
레이아웃 구성:
┌───────────────────────────────────────────┐
│  FAQ 관리                    [+ FAQ 추가]  │
├───────────────────────────────────────────┤
│  카테고리 필터: [전체|회원|대회|클럽|커뮤니티] │
├───────────────────────────────────────────┤
│  ┌─ FAQ 항목 카드 ──────────────────────┐ │
│  │ Q: 회원가입은 어떻게 하나요?         │ │
│  │ A: 카카오, 구글, 네이버 계정으로...   │ │
│  │ [회원/계정] [활성] [수정] [삭제]      │ │
│  └──────────────────────────────────────┘ │
│  ┌─ FAQ 항목 카드 ──────────────────────┐ │
│  │ ...                                  │ │
│  └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

기능:
- 카테고리 필터 (탭 또는 Select)
- FAQ 항목 카드: 질문, 답변 미리보기, 카테고리 배지, 활성 상태 토글
- 추가/수정: Modal 사용 (기존 `Modal` 컴포넌트)
- 삭제: ConfirmDialog 사용

### 5.2 FAQ 추가/수정 모달

```
┌─── FAQ 추가 ─────────────────────┐
│                                   │
│  카테고리  [회원/계정 ▼]           │
│                                   │
│  질문                             │
│  ┌──────────────────────────────┐ │
│  │                              │ │
│  └──────────────────────────────┘ │
│                                   │
│  답변                             │
│  ┌──────────────────────────────┐ │
│  │                              │ │
│  │                              │ │
│  └──────────────────────────────┘ │
│                                   │
│  ☐ 활성화                         │
│                                   │
│  [취소]              [저장]        │
└───────────────────────────────────┘
```

입력 필드:
- 카테고리: Select (FAQ_CATEGORY_LABELS 사용)
- 질문: input (maxLength 200)
- 답변: textarea (maxLength 2000)
- 활성화: checkbox (기본값 true)

### 5.3 AdminSidebar 메뉴 추가

```tsx
// AdminSidebar.tsx의 menuItems 배열에 추가
{
  name: 'FAQ 관리',
  href: '/admin/faq',
  icon: HelpCircle,  // lucide-react
  roles: ['SUPER_ADMIN', 'ADMIN'] as UserRole[],
}
```

문의 관리 아래에 배치.

---

## 6. 구현 순서

| # | 작업 | 파일 | 의존성 |
|---|------|------|--------|
| 1 | DB 마이그레이션 + 시드 데이터 | Supabase MCP | 없음 |
| 2 | 타입 정의 | `src/lib/faq/types.ts` | 없음 |
| 3 | Server Actions | `src/lib/faq/actions.ts` | #1, #2 |
| 4 | FaqSection 컴포넌트 | `src/components/faq/FaqSection.tsx` | #2 |
| 5 | 고객센터 페이지 재구성 | `src/app/support/page.tsx` | #3, #4 |
| 6 | 어드민 FAQ 관리 페이지 | `src/app/admin/faq/page.tsx` | #3 |
| 7 | AdminSidebar 메뉴 추가 | `src/components/admin/AdminSidebar.tsx` | #6 |

---

## 7. 설계 결정 사항

### 7.1 답변 포맷: plain text
- HTML이 아닌 plain text로 저장
- 줄바꿈만 `\n`으로 보존, 렌더링 시 `whitespace-pre-line`으로 처리
- 보안 우려 없이 단순하게 운영 가능
- 관리자가 복잡한 포맷이 필요하면 향후 에디터 도입

### 7.2 RLS: Service Role Key 방식
- FAQ 수정은 ADMIN만 가능하므로 RLS policy 대신 `createAdminClient()`로 처리
- SELECT만 public RLS policy 적용
- 기존 `support/actions.ts`와 동일한 패턴

### 7.3 카테고리: 코드 레벨 고정
- 카테고리를 별도 테이블로 관리하지 않음 (현재 4개로 충분)
- `types.ts`에서 상수로 관리
- 향후 카테고리 추가 시 CHECK 제약 + 타입 수정으로 대응

### 7.4 검색: 클라이언트 사이드
- FAQ 데이터가 수십 개 수준이므로 전체 조회 후 JS 필터링
- 서버 풀텍스트 검색 불필요
- SSR로 초기 데이터 로드, 이후 클라이언트에서 필터/검색

### 7.5 고객센터 페이지: Server Component 전환
- 현재 `'use client'`로 되어 있지만 FAQ SSR을 위해 Server Component로 전환
- 인증 의존 부분(문의 카드)은 별도 Client Component로 분리
