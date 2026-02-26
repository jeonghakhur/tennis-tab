'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const RANK_OPTIONS = ['우승', '준우승', '공동3위', '3위']

interface Props {
  years: number[]
  competitions: string[]
  currentParams: Record<string, string | undefined>
}

export function AwardsFilters({ years, competitions, currentParams }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/awards?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={currentParams.year ?? ''}
        onChange={(e) => update('year', e.target.value)}
        aria-label="연도 필터"
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <option value="">전체 연도</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}년</option>
        ))}
      </select>

      <select
        value={currentParams.competition ?? ''}
        onChange={(e) => update('competition', e.target.value)}
        aria-label="대회 필터"
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <option value="">전체 대회</option>
        {competitions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={currentParams.rank ?? ''}
        onChange={(e) => update('rank', e.target.value)}
        aria-label="순위 필터"
        className="px-3 py-2 rounded-lg border text-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <option value="">전체 순위</option>
        {RANK_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {(currentParams.year || currentParams.competition || currentParams.rank) && (
        <button
          onClick={() => router.push('/awards')}
          className="px-3 py-2 rounded-lg border text-sm transition-colors"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          초기화
        </button>
      )}
    </div>
  )
}
