import { useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TableSkeleton } from '@/components/bone'
import { ConfigDrawer } from '@/components/config-drawer'
import { EmptyState } from '@/components/empty-state'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeMenu } from '@/components/theme-menu'
import { Widget } from '@/components/widget'
import { type Item } from '../../../shared/types'
import { ItemDeleteDialog } from './components/item-delete-dialog'
import { ItemFormDialog } from './components/item-form-dialog'
import { ItemsTable } from './components/items-table'
import { useItems } from './data/use-items'

export function Items() {
  const { t } = useTranslation()
  const query = useItems()

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

  const newItem = (
    <Button variant='pill' onClick={openCreate}>
      <Plus className='size-4' />
      {t('items.newItem')}
    </Button>
  )

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <PageHeader title={t('items.title')} actions={newItem} />

        <Card className='mt-4 gap-4 p-4'>
          <Widget
            query={query}
            skeleton={<TableSkeleton />}
            isEmpty={(d) => d.length === 0}
            empty={
              <EmptyState
                icon={Package}
                heading={t('items.empty.title')}
                body={t('items.empty.body')}
                action={newItem}
              />
            }
          >
            {(items) => (
              <ItemsTable
                items={items}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            )}
          </Widget>
        </Card>
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
