import { useTranslation } from 'react-i18next'
import { useDirection } from '@/context/direction-provider'

/** EN ⇄ HE switch: direction drives language; shows the target language in that language. */
export function LanguageSwitch({ reload = false }: { reload?: boolean }) {
  const { t } = useTranslation()
  const { dir, setDir } = useDirection()
  return (
    <button
      type='button'
      onClick={() => {
        setDir(dir === 'rtl' ? 'ltr' : 'rtl')
        // Clerk reads its localization at load time, so a reload makes the card follow.
        if (reload) window.location.reload()
      }}
      className='hit-44 hover:bg-accent focus-ring h-8 rounded-full px-4 text-xs font-semibold'
    >
      {/* No aria-label: the name must contain the visible text (WCAG 2.5.3). */}
      <span className='sr-only'>{t('languageSwitch.label')}: </span>
      <span lang={dir === 'rtl' ? 'en' : 'he'}>
        {t('languageSwitch.target')}
      </span>
    </button>
  )
}
