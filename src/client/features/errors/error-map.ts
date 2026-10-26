import { ForbiddenError } from '@/features/errors/forbidden'
import { GeneralError } from '@/features/errors/general-error'
import { MaintenanceError } from '@/features/errors/maintenance-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { UnauthorisedError } from '@/features/errors/unauthorized-error'

/**
 * The key here is an unsanitised route parameter — arbitrary text out of the URL. A
 * `Map` has no inherited string keys, so `/errors/toString` misses and takes the 404.
 * Convert this back to an object literal and that URL renders the literal text
 * `[object Object]`, while `/errors/constructor` throws an uncaught React render error
 * on the one route that has no further fallback (SEC-07).
 */
export const ERROR_MAP: ReadonlyMap<string, React.ComponentType> = new Map([
  ['unauthorized', UnauthorisedError],
  ['forbidden', ForbiddenError],
  ['not-found', NotFoundError],
  ['internal-server-error', GeneralError],
  ['maintenance-error', MaintenanceError],
])

export function resolveErrorComponent(slug: string): React.ComponentType {
  return ERROR_MAP.get(slug) ?? NotFoundError
}
