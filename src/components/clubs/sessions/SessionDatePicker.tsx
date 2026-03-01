'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface SessionDatePickerProps {
  value: string   // "YYYY-MM-DD"
  onChange: (value: string) => void
  placeholder?: string
}

export default function SessionDatePicker({ value, onChange, placeholder = '날짜 선택' }: SessionDatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = value ? new Date(value + 'T00:00:00') : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-11 px-3 rounded-lg text-sm text-left flex items-center justify-between box-border"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span>
            {selected ? format(selected, 'yyyy. M. d. (eee)', { locale: ko }) : placeholder}
          </span>
          <CalendarIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          locale={ko}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
