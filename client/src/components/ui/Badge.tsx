import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  icon?: React.ElementType
  title?: string
  className?: string
}

const variantClass: Record<BadgeVariant, string> = {
  default: 'badge-default',
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  accent:  'badge-accent',
  info:    'badge-info',
}

export default function Badge({ variant = 'default', children, icon: Icon, title, className }: BadgeProps) {
  return (
    <span className={[variantClass[variant], className].filter(Boolean).join(' ')} title={title}>
      {Icon && <Icon size={10} stroke={2.5} />}
      {children}
    </span>
  )
}
