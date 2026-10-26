import { useTranslation } from 'react-i18next'
import { ErrorPanel } from './error-panel'

export function ForbiddenError() {
  const { t } = useTranslation()
  return (
    <ErrorPanel
      code='403'
      title={t('errors.forbidden.title')}
      body={t('errors.forbidden.body')}
    />
  )
}
