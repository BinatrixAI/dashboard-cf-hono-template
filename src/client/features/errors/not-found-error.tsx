import { useTranslation } from 'react-i18next'
import { ErrorPanel } from './error-panel'

export function NotFoundError() {
  const { t } = useTranslation()
  return (
    <ErrorPanel
      code='404'
      title={t('errors.notFound.title')}
      body={t('errors.notFound.body')}
    />
  )
}
