import { type TranslationKey } from '@/i18n'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Circle,
  CheckCircle,
  AlertCircle,
  Timer,
  HelpCircle,
  CircleOff,
} from 'lucide-react'

// `label` fields hold translation KEYS — t() is called at render (G2), never
// here at module scope where it would freeze the initial language.
export const labels: { value: string; label: TranslationKey }[] = [
  {
    value: 'bug',
    label: 'tasks.label.bug',
  },
  {
    value: 'feature',
    label: 'tasks.label.feature',
  },
  {
    value: 'documentation',
    label: 'tasks.label.documentation',
  },
]

export const statuses: {
  label: TranslationKey
  value: string
  icon: typeof HelpCircle
}[] = [
  {
    label: 'tasks.status.backlog',
    value: 'backlog',
    icon: HelpCircle,
  },
  {
    label: 'tasks.status.todo',
    value: 'todo',
    icon: Circle,
  },
  {
    label: 'tasks.status.inProgress',
    value: 'in progress',
    icon: Timer,
  },
  {
    label: 'tasks.status.done',
    value: 'done',
    icon: CheckCircle,
  },
  {
    label: 'tasks.status.canceled',
    value: 'canceled',
    icon: CircleOff,
  },
]

export const priorities: {
  label: TranslationKey
  value: string
  icon: typeof ArrowDown
}[] = [
  {
    label: 'tasks.priority.low',
    value: 'low',
    icon: ArrowDown,
  },
  {
    label: 'tasks.priority.medium',
    value: 'medium',
    icon: ArrowRight,
  },
  {
    label: 'tasks.priority.high',
    value: 'high',
    icon: ArrowUp,
  },
  {
    label: 'tasks.priority.critical',
    value: 'critical',
    icon: AlertCircle,
  },
]
