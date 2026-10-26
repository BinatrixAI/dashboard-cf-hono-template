import { useTranslation } from 'react-i18next'
import { ErrorPanel } from './error-panel'

export function UnauthorisedError() {
  const { t } = useTranslation()
  return (
    <ErrorPanel
      code='401'
      title={t('errors.unauthorized.title')}
      body={t('errors.unauthorized.body')}
    />
  )
}
