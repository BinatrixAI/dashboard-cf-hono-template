import { useTranslation } from 'react-i18next'

export function SkipToMain() {
  const { t } = useTranslation()
  return (
    <a
      className='bg-primary text-primary-foreground focus-ring fixed start-4 top-4 z-[999] inline-flex h-9 -translate-y-[200%] items-center rounded-full px-4 text-sm font-semibold focus:translate-y-0'
      href='#content'
    >
      {t('common.skipToContent')}
    </a>
  )
}
