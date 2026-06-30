import { useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { type Item } from '../../../shared/types'
import { ItemDeleteDialog } from './components/item-delete-dialog'
import { ItemFormDialog } from './components/item-form-dialog'
import { ItemsTable } from './components/items-table'
import { useItems } from './data/use-items'

export function Items() {
  const { data: items, isPending, isError, refetch } = useItems()

  // Dialogs are controlled by local state — NOT separate routes (UI-SPEC A1).
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<Item | null>(null)

  function openCreate() {
    setEditItem(null)
    setFormOpen(true)
  }

  function openEdit(item: Item) {
    setEditItem(item)
    setFormOpen(true)
  }

  function openDelete(item: Item) {
    setDeleteItem(item)
    setDeleteOpen(true)
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Items</h1>
          <Button onClick={openCreate}>
            <Plus className='size-4' />
            New Item
          </Button>
        </div>

        <div className='mt-4'>
          {isPending ? (
            <ItemsLoading />
          ) : isError ? (
            <ItemsError onRefresh={() => refetch()} />
          ) : items.length === 0 ? (
            <ItemsEmpty onNew={openCreate} />
          ) : (
            <ItemsTable items={items} onEdit={openEdit} onDelete={openDelete} />
          )}
        </div>
      </Main>

      <ItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
      />
      <ItemDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        item={deleteItem}
      />
    </>
  )
}

function ItemsLoading() {
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
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className='h-4 w-3/5' />
            </TableCell>
            <TableCell>
              <Skeleton className='h-4 w-4/5' />
            </TableCell>
            <TableCell>
              <Skeleton className='h-4 w-10' />
            </TableCell>
            <TableCell>
              <div className='flex justify-end gap-1'>
                <Skeleton className='size-7' />
                <Skeleton className='size-7' />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ItemsEmpty({ onNew }: { onNew: () => void }) {
  return (
    <div className='flex flex-col items-center gap-4 py-16'>
      <Package className='text-muted-foreground size-12' />
      <div className='flex flex-col items-center gap-1'>
        <p className='text-base font-medium'>No items yet</p>
        <p className='text-muted-foreground text-sm'>
          Create your first item to get started.
        </p>
      </div>
      <Button onClick={onNew}>
        <Plus className='size-4' />
        New Item
      </Button>
    </div>
  )
}

function ItemsError({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>Could not load items</AlertTitle>
        <AlertDescription>
          Check your connection and refresh the page.
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  )
}
