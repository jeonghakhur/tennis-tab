'use client'

import { useRef, useCallback } from 'react'

interface EntryStatusFilterProps {
  selected: string  // 'ALL' | EntryStatus
  onChange: (status: string) => void
  counts?: Record<string, number>
}

// 필터 탭 옵션 (순서 고정)
const FILTER_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING', label: '대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'CONFIRMED', label: '확정' },
  { value: 'WAITLISTED', label: '대기자' },
  { value: 'CANCELLED', label: '취소' },
] as const

export function EntryStatusFilter({ selected, onChange, counts }: EntryStatusFilterProps) {
  const tabListRef = useRef<HTMLDivElement>(null)

  // 키보드 좌/우 화살표로 탭 이동
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    if (!tabs) return

    const currentIndex = Array.from(tabs).findIndex(tab => tab === e.currentTarget)
    let nextIndex = -1

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else {
      return
    }

    e.preventDefault()
    const nextTab = tabs[nextIndex]
    nextTab.focus()
    onChange(FILTER_OPTIONS[nextIndex].value)
  }, [onChange])

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="신청 상태 필터"
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {FILTER_OPTIONS.map((option) => {
        const isSelected = selected === option.value
        const count = counts?.[option.value]

        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isSelected ? 'var(--accent-color)' : 'var(--bg-card-hover)',
              color: isSelected ? 'var(--bg-primary)' : 'var(--text-muted)',
              outlineColor: 'var(--accent-color)',
            }}
          >
            {option.label}
            {count !== undefined && (
              <span
                className="ml-1.5 text-xs"
                style={{
                  opacity: isSelected ? 0.8 : 0.6,
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
