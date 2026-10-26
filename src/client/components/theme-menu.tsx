import { type TranslationKey } from '@/i18n'
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePersistTheme } from '@/features/settings/data/use-settings'

const MODES: {
  value: 'light' | 'dark' | 'system'
  icon: typeof Sun
  label: TranslationKey
}[] = [
  { value: 'light', icon: Sun, label: 'settings.appearance.light' },
  { value: 'dark', icon: Moon, label: 'settings.appearance.dark' },
  { value: 'system', icon: Monitor, label: 'settings.appearance.system' },
]

type Mode = (typeof MODES)[number]['value']

/** Light / Dark / System picker (D-13): applies at once, saves to KV when signed in. */
export function ThemeMenu({
  showLabel = false,
  className,
}: {
  showLabel?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const persistTheme = usePersistTheme()
  const selected = MODES.find((m) => m.value === theme) ?? MODES[2]
  const Icon = selected.icon

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {showLabel ? (
          <Button variant='outline' className={cn('hit-44', className)}>
            <Icon />
            {t(selected.label)}
            <ChevronDown />
          </Button>
        ) : (
          <Button
            variant='ghost'
            aria-label={t('settings.appearance.themeLabel')}
            className={cn(
              'hit-44 hover:bg-accent focus-ring size-9 rounded-full',
              className
            )}
          >
            <Icon />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-40'>
        <DropdownMenuLabel>
          {t('settings.appearance.themeLabel')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => persistTheme(v as Mode)}
        >
          {MODES.map(({ value, icon: ItemIcon, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <ItemIcon className='size-4' />
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
