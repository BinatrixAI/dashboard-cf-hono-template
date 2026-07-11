import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { type ContentItem } from '../data/schema'

// Read-only, three columns only (D-02) — mirrors features/users/components/
// users-columns.tsx but drops the select-checkbox and role columns (no bulk
// actions, no mutations this phase). Header `title` fields hold translation
// KEYS; DataTableColumnHeader calls t() at render (G2), so these columns need
// no t threading and stay a plain module const.
export const contentColumns: ColumnDef<ContentItem>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='content.columns.title' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-72 ps-3'>{row.getValue('title')}</LongText>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='content.columns.status' />
    ),
    cell: ({ row }) => {
      // status is optional on the CMS item (anon read returns 'published'; a
      // missing value renders a dash rather than an empty badge).
      const status = row.getValue<string | undefined>('status')
      if (!status) return <span className='text-muted-foreground'>—</span>
      return (
        <Badge variant='outline' className='capitalize'>
          {status}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    id: 'published',
    // Pitfall 4: prefer data.publishedAt, fall back to created_at (ms epoch)
    // when null/absent so the column is never blank for a published post.
    accessorFn: (row) => row.data?.publishedAt ?? row.created_at ?? null,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title='content.columns.published'
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue<string | number | null>()
      if (value === null || value === undefined)
        return <span className='text-muted-foreground'>—</span>
      return <div>{new Date(value).toLocaleDateString()}</div>
    },
  },
]
