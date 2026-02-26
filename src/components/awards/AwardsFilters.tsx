'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RANK_OPTIONS = ['우승', '준우승', '공동3위', '3위']
const ALL = '__all__'

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

  const handleChange = (key: string) => (value: string) => {
    update(key, value === ALL ? '' : value)
  }

  const hasFilter = currentParams.year || currentParams.competition || currentParams.rank

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Select
        value={currentParams.year ?? ALL}
        onValueChange={handleChange('year')}
      >
        <SelectTrigger
          aria-label="연도 필터"
          className="px-3 py-2 rounded-lg bg-(--bg-card) text-(--text-primary) border border-(--border-color)"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체 연도</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentParams.competition ?? ALL}
        onValueChange={handleChange('competition')}
      >
        <SelectTrigger
          aria-label="대회 필터"
          className="px-3 py-2 rounded-lg bg-(--bg-card) text-(--text-primary) border border-(--border-color)"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체 대회</SelectItem>
          {competitions.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentParams.rank ?? ALL}
        onValueChange={handleChange('rank')}
      >
        <SelectTrigger
          aria-label="순위 필터"
          className="px-3 py-2 rounded-lg bg-(--bg-card) text-(--text-primary) border border-(--border-color)"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체 순위</SelectItem>
          {RANK_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
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
