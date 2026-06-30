import { Pencil, Trash2 } from 'lucide-react'
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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className='w-[120px]'>Created</TableHead>
          <TableHead className='w-[80px]'>
            <span className='sr-only'>Actions</span>
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
                  aria-label={`Edit ${item.name}`}
                  onClick={() => onEdit(item)}
                >
                  <Pencil className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={`Delete ${item.name}`}
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
