'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, PenLine, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Association {
  id: string
  name: string
}

/** 선택 결과: 기존 협회 or 직접 입력 or 독립 클럽 */
export interface AssociationValue {
  association_id: string | null
  association_name: string
}

interface AssociationComboboxProps {
  associations: Association[]
  value: AssociationValue
  onChange: (value: AssociationValue) => void
}

export function AssociationCombobox({ associations, value, onChange }: AssociationComboboxProps) {
  const [open, setOpen] = useState(false)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)

  // 초기 렌더: association_id가 없고 association_name이 있으면 직접 입력 모드
  useEffect(() => {
    if (!value.association_id && value.association_name) {
      setIsCustomMode(true)
    }
  }, []) // 마운트 시 1회만

  // 현재 선택된 협회 이름
  const selectedAssociation = associations.find((a) => a.id === value.association_id)
  const displayLabel = isCustomMode
    ? value.association_name || ''
    : selectedAssociation
      ? selectedAssociation.name
      : '독립 클럽 (소속 없음)'

  // 기존 협회 선택
  const handleSelect = (associationId: string) => {
    if (associationId === '__none__') {
      onChange({ association_id: null, association_name: '' })
      setIsCustomMode(false)
    } else {
      const assoc = associations.find((a) => a.id === associationId)
      onChange({ association_id: associationId, association_name: assoc?.name || '' })
      setIsCustomMode(false)
    }
    setOpen(false)
  }

  // "직접 입력" 모드 전환
  const handleCustomMode = () => {
    setIsCustomMode(true)
    onChange({ association_id: null, association_name: '' })
    setOpen(false)
    // 다음 렌더 후 input에 포커스
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  // 직접 입력 취소 → 독립 클럽으로 복귀
  const handleCancelCustom = () => {
    setIsCustomMode(false)
    onChange({ association_id: null, association_name: '' })
  }

  // 직접 입력 모드일 때
  if (isCustomMode) {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={customInputRef}
            type="text"
            value={value.association_name}
            onChange={(e) => onChange({ association_id: null, association_name: e.target.value })}
            placeholder="협회 이름을 입력하세요"
            maxLength={100}
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none pr-9"
            aria-label="협회 이름 직접 입력"
          />
          <button
            type="button"
            onClick={handleCancelCustom}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-(--bg-secondary) text-(--text-muted) hover:text-(--text-primary) transition-colors"
            aria-label="직접 입력 취소"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Combobox (Popover + Command)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="소속 협회 선택"
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
            'bg-(--bg-input) text-(--text-primary) border-(--border-color)',
            'hover:border-(--accent-color) focus:border-(--accent-color)',
            !selectedAssociation && 'text-(--text-muted)',
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="협회 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            {/* 직접 입력 옵션 */}
            <CommandGroup>
              <CommandItem
                value="__custom__직접 입력"
                onSelect={handleCustomMode}
              >
                <PenLine className="mr-2 h-4 w-4" />
                직접 입력
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {/* 독립 클럽 옵션 */}
              <CommandItem
                value="__none__독립 클럽"
                onSelect={() => handleSelect('__none__')}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !value.association_id && !isCustomMode ? 'opacity-100' : 'opacity-0',
                  )}
                />
                독립 클럽 (소속 없음)
              </CommandItem>
              {/* 기존 협회 목록 */}
              {associations.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.id + a.name}
                  onSelect={() => handleSelect(a.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value.association_id === a.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {a.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
