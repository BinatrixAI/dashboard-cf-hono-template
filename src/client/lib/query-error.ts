import { statusOf } from './http-error'

/**
 * Does a failed query leave for the /500 page? Only when there is nothing on screen to
 * keep. A refetch that fails over data already on screen keeps the screen (the toast
 * still says so), because throwing away a working list mid-task helps nobody.
 */
export const leavesForErrorPage = (query: {
  state: { data: unknown }
}): boolean => query.state.data === undefined

/** Retry only network errors and 5xx: a 4xx is deterministic, so retrying only delays the error state. */
export const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const status = statusOf(error)
  return failureCount <= 3 && (status === undefined || status >= 500)
}
