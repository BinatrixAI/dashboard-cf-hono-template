import { useQuery } from '@tanstack/react-query'
import { tasks } from './tasks'

// Named useTaskList: tasks-provider already exports useTasks (dialog state).
export const taskListQueryKey = ['tasks'] as const

export function useTaskList() {
  return useQuery({
    queryKey: taskListQueryKey,
    // Demo seam: a fork swaps this for fetch('/api/tasks') + HttpError, like use-items.ts.
    queryFn: async () => tasks,
  })
}
