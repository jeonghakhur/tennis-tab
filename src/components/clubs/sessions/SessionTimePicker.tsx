'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SessionTimePickerProps {
  value: string       // "HH:MM"
  onChange: (value: string) => void
  placeholder?: string
}

// 06:00 ~ 22:00, 30분 단위
const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function formatLabel(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${ampm} ${hour}:${String(m).padStart(2, '0')}`
}

export default function SessionTimePicker({ value, onChange, placeholder = '시간 선택' }: SessionTimePickerProps) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger
        className="w-full h-11 px-3 text-sm"
        style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        {TIME_OPTIONS.map((t) => (
          <SelectItem
            key={t}
            value={t}
            style={{ color: 'var(--text-primary)' }}
          >
            {formatLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
