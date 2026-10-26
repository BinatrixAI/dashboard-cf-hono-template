import { useTranslation } from 'react-i18next'
import { ThemeMenu } from '@/components/theme-menu'

// One labelled row (D-13): the ThemeMenu applies the theme on select and saves it
// to KV itself (usePersistTheme), so there is no form, submit or load gate here.
export function AppearanceForm() {
  const { t } = useTranslation()

  return (
    <div className='flex flex-wrap items-center justify-between gap-4'>
      <div>
        <p className='text-sm font-semibold'>
          {t('settings.appearance.themeLabel')}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t('settings.appearance.themeDesc')}
        </p>
      </div>
      <ThemeMenu showLabel />
    </div>
  )
}
