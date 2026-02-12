export type BadgeVariant = 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'orange'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}
