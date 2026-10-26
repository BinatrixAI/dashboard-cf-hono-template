import { Download, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useTasks } from './tasks-provider'

export function TasksPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useTasks()
  return (
    <div className='flex gap-2'>
      <Button variant='outline' onClick={() => setOpen('import')}>
        <Download className='size-4' />
        {t('tasks.buttons.import')}
      </Button>
      <Button variant='pill' onClick={() => setOpen('create')}>
        <Plus className='size-4' />
        {t('tasks.buttons.create')}
      </Button>
    </div>
  )
}
