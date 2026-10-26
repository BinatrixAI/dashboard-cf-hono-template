import { useTranslation } from 'react-i18next'
import { ErrorPanel } from './error-panel'

export function MaintenanceError() {
  const { t } = useTranslation()
  return (
    <ErrorPanel
      code='503'
      title={t('errors.maintenance.title')}
      body={t('errors.maintenance.body')}
    />
  )
}
