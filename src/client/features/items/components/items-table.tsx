import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Item } from '../../../../shared/types'

type ItemsTableProps = {
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
}

export function ItemsTable({ items, onEdit, onDelete }: ItemsTableProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('items.columns.name')}</TableHead>
          <TableHead>{t('items.columns.description')}</TableHead>
          <TableHead className='w-[120px]'>
            {t('items.columns.created')}
          </TableHead>
          <TableHead className='w-[80px]'>
            <span className='sr-only'>{t('items.columns.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className='text-sm font-medium'>{item.name}</TableCell>
            <TableCell className='text-muted-foreground text-sm'>
              <span className='block max-w-[320px] truncate'>
                {item.description}
              </span>
            </TableCell>
            <TableCell className='text-muted-foreground text-sm'>
              {new Date(item.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className='text-end'>
              <div className='flex justify-end gap-1'>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={t('items.editAria', { name: item.name })}
                  onClick={() => onEdit(item)}
                >
                  <Pencil className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={t('items.deleteAria', { name: item.name })}
                  onClick={() => onDelete(item)}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
