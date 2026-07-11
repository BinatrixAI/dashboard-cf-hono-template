import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { type Item } from '../../../../shared/types'
import { useDeleteItem } from '../data/use-items'

type ItemDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Item | null
}

export function ItemDeleteDialog({
  open,
  onOpenChange,
  item,
}: ItemDeleteDialogProps) {
  const { t } = useTranslation()
  const deleteItem = useDeleteItem()

  useEffect(() => {
    if (open) deleteItem.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!item) return null

  function handleDelete(e: React.MouseEvent) {
    // Keep the AlertDialog open while the request is in flight / on error.
    e.preventDefault()
    if (!item) return
    deleteItem.mutate(item.id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('items.delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('items.delete.desc', { name: item.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteItem.isError ? (
          <p className='text-destructive mt-2 text-sm'>
            {t('items.delete.failed')}
          </p>
        ) : null}

        <AlertDialogFooter>
          {/* Focus lands on Cancel by default (less destructive option). */}
          <AlertDialogCancel>{t('items.delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            disabled={deleteItem.isPending}
            onClick={handleDelete}
          >
            {deleteItem.isPending ? (
              <Loader2 className='mr-2 size-4 animate-spin' />
            ) : null}
            {deleteItem.isPending
              ? t('items.delete.deleting')
              : t('items.delete.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
