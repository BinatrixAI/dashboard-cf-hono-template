import { useTranslation } from 'react-i18next'
import { ErrorPanel } from './error-panel'

export function GeneralError() {
  const { t } = useTranslation()
  return (
    <ErrorPanel
      code='500'
      title={t('errors.serverError.title')}
      body={t('errors.serverError.body')}
    />
  )
}
