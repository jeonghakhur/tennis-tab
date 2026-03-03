'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface YearMonth {
  year: number
  month: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

const selectTriggerStyle = {
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
}
const selectContentStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
}
const selectItemStyle = { color: 'var(--text-primary)' }

interface YearMonthPickerProps {
  value: YearMonth
  onChange: (value: YearMonth) => void
  label?: string
}

export default function YearMonthPicker({ value, onChange, label }: YearMonthPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-(--text-muted)">{label}</span>}

      <Select
        value={String(value.year)}
        onValueChange={(v) => onChange({ ...value, year: parseInt(v) })}
      >
        <SelectTrigger className="h-8 w-24 text-xs px-2" style={selectTriggerStyle}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent style={selectContentStyle}>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y} value={String(y)} style={selectItemStyle}>
              {y}년
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(value.month)}
        onValueChange={(v) => onChange({ ...value, month: parseInt(v) })}
      >
        <SelectTrigger className="h-8 w-20 text-xs px-2" style={selectTriggerStyle}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent style={selectContentStyle}>
          {MONTH_OPTIONS.map((m) => (
            <SelectItem key={m} value={String(m)} style={selectItemStyle}>
              {m}월
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
