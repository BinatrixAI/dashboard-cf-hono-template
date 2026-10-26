import { type TranslationKey } from '@/i18n'
import { Shield, UserCheck, Users, CreditCard } from 'lucide-react'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-success-soft text-success-fg border-success/30'],
  ['inactive', 'bg-muted text-muted-foreground border-border'],
  ['invited', 'bg-brand-soft text-brand-fg border-brand/30'],
  [
    'suspended',
    'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  ],
])

// `label` fields hold translation KEYS — t() is called at render (G2).
export const roles: {
  label: TranslationKey
  value: string
  icon: typeof Shield
}[] = [
  {
    label: 'users.role.superadmin',
    value: 'superadmin',
    icon: Shield,
  },
  {
    label: 'users.role.admin',
    value: 'admin',
    icon: UserCheck,
  },
  {
    label: 'users.role.manager',
    value: 'manager',
    icon: Users,
  },
  {
    label: 'users.role.cashier',
    value: 'cashier',
    icon: CreditCard,
  },
]
