'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matchesKoreanSearch } from '@/lib/utils/korean'
import type { ClubOption } from '@/lib/finance/actions'

interface Props {
  clubs: ClubOption[]
  value: string | null
  onChange: (clubId: string | null) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/** 클럽 선택 콤보박스 — 초성 검색, 선택 해제 가능 */
export function ClubCombobox({ clubs, value, onChange, placeholder = '클럽 선택 (선택)', className, ...aria }: Props) {
  const [open, setOpen] = useState(false)
  const selected = clubs.find((c) => c.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative w-full', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={aria['aria-label'] ?? '클럽 선택'}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg border outline-none transition-colors text-sm w-full',
              'bg-(--bg-input) text-(--text-primary) border-(--border-color) hover:border-(--accent-color) focus:border-(--accent-color)',
              !selected && 'text-(--text-muted)',
              selected && 'pr-14',
            )}
          >
            <span className="truncate">{selected ? selected.name : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
          </button>
        </PopoverTrigger>
        {/* 선택 해제 — 트리거 버튼 밖의 독립 버튼 (버튼 중첩 금지) */}
        {selected && (
          <button
            type="button"
            aria-label="클럽 선택 해제"
            onClick={() => onChange(null)}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-(--bg-secondary) text-(--text-muted)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const name = itemValue.split('::')[1] ?? itemValue
            return matchesKoreanSearch(name, search) ? 1 : 0
          }}
        >
          <CommandInput placeholder="클럽 검색 (초성 지원)" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {clubs.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.id}::${c.name}`}
                  onSelect={() => { onChange(c.id); setOpen(false) }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  {c.name}
                  {c.court_slot && <span className="ml-auto text-sm text-(--text-muted)">{c.court_slot}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
