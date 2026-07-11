import { type TranslationKey } from '@/i18n'
import { Shield, UserCheck, Users, CreditCard } from 'lucide-react'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
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
