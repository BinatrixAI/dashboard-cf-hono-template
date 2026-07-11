import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createItemSchema, type Item } from '../../../../shared/types'
import { useCreateItem, useUpdateItem } from '../data/use-items'

type ItemFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog is in edit mode and pre-fills from this item. */
  item: Item | null
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
}: ItemFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = item !== null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const isSubmitting = createItem.isPending || updateItem.isPending
  const isApiError = createItem.isError || updateItem.isError

  // Reset / pre-fill whenever the dialog opens (UI-SPEC: edit pre-fills Name + Description).
  useEffect(() => {
    if (open) {
      // Intentional synchronous pre-fill when the dialog opens (UI-SPEC):
      // mirrors props into local form state on the open transition.
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(item?.name ?? '')
      setDescription(item?.description ?? '')
      setNameError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      createItem.reset()
      updateItem.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Client-side validation via the SHARED schema (defense in depth — the server
    // re-validates; threat T-1-03). Block the API call on an empty name.
    const parsed = createItemSchema.safeParse({ name, description })
    if (!parsed.success) {
      setNameError(t('items.form.nameRequired'))
      return
    }
    setNameError(null)

    const onSuccess = () => onOpenChange(false)
    if (isEdit && item) {
      updateItem.mutate(
        {
          id: item.id,
          input: {
            name: parsed.data.name,
            description: parsed.data.description,
          },
        },
        { onSuccess }
      )
    } else {
      createItem.mutate(
        { name: parsed.data.name, description: parsed.data.description },
        { onSuccess }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('items.form.editTitle') : t('items.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>{t('items.form.nameLabel')}</Label>
            <Input
              id='name'
              placeholder={t('items.form.namePlaceholder')}
              maxLength={100}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              // UI-SPEC keyboard rule: Enter in the Name input must not submit.
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              aria-invalid={nameError !== null}
            />
            {nameError ? (
              <p className='text-destructive text-sm'>{nameError}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='description'>{t('items.form.descLabel')}</Label>
            <Textarea
              id='description'
              placeholder={t('items.form.descPlaceholder')}
              maxLength={500}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {isApiError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('items.form.saveFailed')}</AlertTitle>
              <AlertDescription>
                {t('items.form.saveFailedDesc')}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('items.form.cancel')}
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className='size-4 animate-spin' />
              ) : null}
              {isSubmitting
                ? t('items.form.saving')
                : isEdit
                  ? t('items.form.saveChanges')
                  : t('items.form.createItem')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
