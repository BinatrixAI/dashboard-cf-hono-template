import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { type AppSettings } from '../../../../shared/settings'
import {
  useSettings,
  useUpdateSettings,
} from '@/features/settings/data/use-settings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

// Section shape reconciled to the server `AppSettings['notifications']` (D-03):
// the email booleans are non-optional `z.boolean()` (was `.default(false).optional()`),
// so `NotificationsFormValues` is structurally assignable to the schema section and
// the merge needs no transform. Plain `z.boolean()` (no `.default()`) keeps the schema
// input and output types identical, which `zodResolver`'s generics require; the actual
// initial values come from the KV-hydrated `defaultValues` below, so per-field `.default`s
// are redundant here.
const notificationsFormSchema = z.object({
  type: z.enum(['all', 'mentions', 'none'], {
    error: (iss) =>
      iss.input === undefined
        ? 'Please select a notification type.'
        : undefined,
  }),
  mobile: z.boolean(),
  communication_emails: z.boolean(),
  social_emails: z.boolean(),
  marketing_emails: z.boolean(),
  security_emails: z.boolean(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

// Load gate (D-06 / Pitfall 2): never render or save hardcoded defaults before
// the stored KV blob resolves. Mirrors the `items/index.tsx` isPending/isError
// idiom — only the resolved-data branch mounts the editable form.
export function NotificationsForm() {
  const { data, isPending, isError, refetch } = useSettings()

  if (isPending) return <NotificationsFormSkeleton />
  if (isError) return <NotificationsFormError onRetry={() => refetch()} />

  return <NotificationsFormFields data={data} />
}

function NotificationsFormFields({ data }: { data: AppSettings }) {
  const update = useUpdateSettings()

  // Hydrate defaults from the stored KV notifications section (D-06) — this
  // component only mounts once `data` is present, so the form never flashes a
  // pre-GET hardcoded value.
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      type: data.notifications.type,
      mobile: data.notifications.mobile,
      communication_emails: data.notifications.communication_emails,
      social_emails: data.notifications.social_emails,
      marketing_emails: data.notifications.marketing_emails,
      security_emails: data.notifications.security_emails,
    },
  })

  function onSubmit(values: NotificationsFormValues) {
    // Merge only the notifications section into the full cached blob and PUT the
    // whole document (D-05, Pitfall 1) — never a partial that drops siblings.
    const next: AppSettings = { ...data, notifications: values }
    update.mutate(next, {
      onSuccess: () => toast.success('Preferences updated'),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='type'
          render={({ field }) => (
            <FormItem className='relative space-y-3'>
              <FormLabel>Notify me about...</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className='flex flex-col gap-2'
                >
                  <FormItem className='flex items-center'>
                    <FormControl>
                      <RadioGroupItem value='all' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      All new messages
                    </FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center'>
                    <FormControl>
                      <RadioGroupItem value='mentions' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      Direct messages and mentions
                    </FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center'>
                    <FormControl>
                      <RadioGroupItem value='none' />
                    </FormControl>
                    <FormLabel className='font-normal'>Nothing</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='relative'>
          <h3 className='mb-4 text-lg font-medium'>Email Notifications</h3>
          <div className='space-y-4'>
            <FormField
              control={form.control}
              name='communication_emails'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Communication emails
                    </FormLabel>
                    <FormDescription>
                      Receive emails about your account activity.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='marketing_emails'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Marketing emails
                    </FormLabel>
                    <FormDescription>
                      Receive emails about new products, features, and more.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='social_emails'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Social emails</FormLabel>
                    <FormDescription>
                      Receive emails for friend requests, follows, and more.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='security_emails'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Security emails</FormLabel>
                    <FormDescription>
                      Receive emails about your account activity and security.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled
                      aria-readonly
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name='mobile'
          render={({ field }) => (
            <FormItem className='relative flex flex-row items-start'>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel>
                  Use different settings for my mobile devices
                </FormLabel>
                <FormDescription>
                  You can manage your mobile notifications in the{' '}
                  <Link
                    to='/settings'
                    className='underline decoration-dashed underline-offset-4 hover:decoration-solid'
                  >
                    mobile settings
                  </Link>{' '}
                  page.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <Button type='submit'>Update notifications</Button>
      </form>
    </Form>
  )
}

function NotificationsFormSkeleton() {
  return (
    <div className='space-y-8'>
      <div className='space-y-3'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-5 w-56' />
        <Skeleton className='h-5 w-24' />
      </div>
      <div className='space-y-4'>
        <Skeleton className='h-4 w-40' />
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
      </div>
      <Skeleton className='h-9 w-44' />
    </div>
  )
}

function NotificationsFormError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>Could not load notification settings</AlertTitle>
        <AlertDescription>
          Check your connection and try again.
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
