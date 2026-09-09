'use client'

/**
 * 공용 토글 스위치 (WAI-ARIA switch 패턴)
 *
 * - `<button role="switch" aria-checked>` — 키보드(Space/Enter) 접근 가능
 * - OFF 트랙은 `--text-muted` 반투명 회색: `--bg-secondary`/`--border-color`는 카드 배경과 겹쳐
 *   다크·라이트 어느 쪽에서든 구분이 안 되던 문제를 해결
 * - 라벨은 `aria-label` 또는 `aria-labelledby` 중 하나를 반드시 전달
 */
export type SwitchVariant = 'accent' | 'success'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** ON 색상 — accent(기본) | success(초록) */
  variant?: SwitchVariant
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-busy'?: boolean
  className?: string
}

const ON_TRACK: Record<SwitchVariant, string> = {
  accent: 'bg-(--accent-color)',
  success: 'bg-(--color-success)',
}

const OFF_TRACK = 'bg-(--text-muted)/40 hover:bg-(--text-muted)/55'

export function Switch({
  checked,
  onChange,
  disabled = false,
  variant = 'accent',
  className = '',
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      aria-busy={aria['aria-busy']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-color) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) ${
        checked ? ON_TRACK[variant] : OFF_TRACK
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
