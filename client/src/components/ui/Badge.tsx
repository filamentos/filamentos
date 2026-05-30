import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  icon?: React.ElementType
}

const variantClass: Record<BadgeVariant, string> = {
  default: 'badge-default',
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  accent:  'badge-accent',
  info:    'badge-info',
}

export default function Badge({ variant = 'default', children, icon: Icon }: BadgeProps) {
  return (
    <span className={variantClass[variant]}>
      {Icon && <Icon size={10} stroke={2.5} />}
      {children}
    </span>
  )
}
