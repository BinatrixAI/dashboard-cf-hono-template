import { useQuery } from '@tanstack/react-query'
import { type User } from './schema'

/**
 * Users data layer (D-04): a read-only network round-trip to the Hono
 * `GET /api/users` router (Plan 02), NOT a faker dataset. Mirrors the read-only
 * `useQuery` slice of `features/items/data/use-items.ts` — no mutations, because
 * the Users module is read-only against real Clerk accounts (D-02a).
 *
 * The server returns the mapped Row shape with dates as ISO strings; the ported
 * `./schema.ts` `User` type uses `z.coerce.date()`, which tolerates those.
 */

export const usersQueryKey = ['users'] as const

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users')
  if (!res.ok) {
    // Carry the HTTP status so the page can distinguish 403 (admin gate —
    // caller lacks the admin role) from genuine load failures.
    throw Object.assign(new Error(`Failed to load users (${res.status})`), {
      status: res.status,
    })
  }
  const data = (await res.json()) as { users: User[] }
  return data.users
}

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: fetchUsers,
  })
}
