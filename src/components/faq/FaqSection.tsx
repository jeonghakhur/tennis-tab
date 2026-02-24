'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { Faq, FaqCategoryItem } from '@/lib/faq/types'

interface FaqSectionProps {
  faqs: Faq[]
  categories: FaqCategoryItem[]
}

export function FaqSection({ faqs, categories }: FaqSectionProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.slug ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // 카테고리 slug → name 맵
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories],
  )

  // 검색 시 전체 카테고리, 아니면 선택 카테고리만
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    if (q) {
      return faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q),
      )
    }

    return faqs.filter((faq) => faq.category === activeCategory)
  }, [faqs, activeCategory, searchQuery])

  // 개별 토글 (다른 항목에 영향 없음)
  const handleToggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <h2
        className="text-2xl font-display mb-6"
        style={{ color: 'var(--text-primary)' }}
      >
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
                     focus:ring-2 focus:ring-emerald-500/30"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          aria-label="FAQ 검색"
        />
      </div>

      {/* 카테고리 탭 (검색 중에는 숨김) */}
      {!searchQuery && categories.length > 0 && (
        <div
          className="flex gap-1 mb-5 border-b overflow-x-auto"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="FAQ 카테고리"
        >
          {categories.map((cat) => (
            <button
              key={cat.slug}
              role="tab"
              aria-selected={activeCategory === cat.slug}
              onClick={() => {
                setActiveCategory(cat.slug)
                setOpenIds(new Set())
              }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                ${activeCategory === cat.slug ? 'border-b-2' : ''}`}
              style={{
                borderColor:
                  activeCategory === cat.slug ? 'var(--accent-color)' : 'transparent',
                color:
                  activeCategory === cat.slug ? 'var(--accent-color)' : 'var(--text-muted)',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 아코디언 리스트 */}
      {filteredFaqs.length === 0 ? (
        <p
          className="text-sm py-8 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
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
              {/* 질문 */}
              <button
                onClick={() => handleToggle(faq.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-(--bg-card-hover)"
                style={{ color: 'var(--text-primary)' }}
                aria-expanded={openIds.has(faq.id)}
                aria-controls={`faq-answer-${faq.id}`}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200
                    ${openIds.has(faq.id) ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--text-muted)' }}
                />
              </button>

              {/* 답변 */}
              <div
                id={`faq-answer-${faq.id}`}
                role="region"
                className={`overflow-hidden transition-all duration-200
                  ${openIds.has(faq.id) ? 'max-h-96' : 'max-h-0'}`}
              >
                <div
                  className="px-4 pt-2 pb-4 text-sm leading-relaxed whitespace-pre-line"
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
