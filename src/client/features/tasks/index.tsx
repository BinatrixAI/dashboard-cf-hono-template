import { ListTodo } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { TasksDialogs } from './components/tasks-dialogs'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { TasksProvider } from './components/tasks-provider'
import { TasksTable } from './components/tasks-table'
import { useTaskList } from './data/use-task-list'

export function Tasks() {
  const { t } = useTranslation()
  const query = useTaskList()
  return (
    <TasksProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <PageHeader
          title={t('tasks.title')}
          subtitle={t('tasks.subtitle')}
          actions={<TasksPrimaryButtons />}
        />
        <Card className='scroll-mt-20 gap-4 p-4'>
          <Widget
            query={query}
            skeleton={<TableSkeleton />}
            isEmpty={(d) => d.length === 0}
            empty={
              <EmptyState
                icon={ListTodo}
                heading={t('tasks.empty.title')}
                body={t('tasks.empty.body')}
              />
            }
          >
            {(data) => <TasksTable data={data} />}
          </Widget>
        </Card>
      </Main>

      <TasksDialogs />
    </TasksProvider>
  )
}
