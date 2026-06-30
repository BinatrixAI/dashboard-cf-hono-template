import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type CreateItemInput,
  type Item,
  type UpdateItemInput,
} from '../../../../shared/types'

/**
 * Items data layer (D-04): a GENUINE network round-trip to the Hono `/api/items`
 * router (Plan 02), NOT client-only state (RESEARCH Pitfall 6). The query key is
 * shared with the create/edit/delete mutations so each mutation invalidates the
 * list and the UI re-fetches the authoritative server state (UI-SPEC A14).
 */

export const itemsQueryKey = ['items'] as const

async function fetchItems(): Promise<Item[]> {
  const res = await fetch('/api/items')
  if (!res.ok) {
    throw new Error(`Failed to load items (${res.status})`)
  }
  const data = (await res.json()) as { items: Item[] }
  return data.items
}

export function useItems() {
  return useQuery({
    queryKey: itemsQueryKey,
    queryFn: fetchItems,
  })
}

async function createItem(input: CreateItemInput): Promise<Item> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to create item (${res.status})`)
  const data = (await res.json()) as { item: Item }
  return data.item
}

async function updateItem(id: string, input: UpdateItemInput): Promise<Item> {
  const res = await fetch(`/api/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to update item (${res.status})`)
  const data = (await res.json()) as { item: Item }
  return data.item
}

async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete item (${res.status})`)
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      // Real round-trip, no manual cache mutation (UI-SPEC A14): re-fetch the
      // authoritative server list after a successful write.
      queryClient.invalidateQueries({ queryKey: itemsQueryKey })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateItemInput }) =>
      updateItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQueryKey })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQueryKey })
    },
  })
}
