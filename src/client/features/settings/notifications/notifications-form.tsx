import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { type TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import {
  useSettings,
  useUpdateSettings,
} from '@/features/settings/data/use-settings'
import { type AppSettings } from '../../../../shared/settings'

// Section shape reconciled to the server `AppSettings['notifications']` (D-03):
// the email booleans are non-optional `z.boolean()` (was `.default(false).optional()`),
// so `NotificationsFormValues` is structurally assignable to the schema section and
// the merge needs no transform. Plain `z.boolean()` (no `.default()`) keeps the schema
// input and output types identical, which `zodResolver`'s generics require; the actual
// initial values come from the KV-hydrated `defaultValues` below, so per-field `.default`s
// are redundant here.
// Schema factory (G2): validation messages are pulled from t() at render via
// makeSchema(t) + useMemo — never a module-scope t() that would freeze the
// initial language.
function makeSchema(t: TFunction) {
  return z.object({
    type: z.enum(['all', 'mentions', 'none'], {
      error: (iss) =>
        iss.input === undefined
          ? t('settings.notifications.typeRequired')
          : undefined,
    }),
    mobile: z.boolean(),
    communication_emails: z.boolean(),
    social_emails: z.boolean(),
    marketing_emails: z.boolean(),
    security_emails: z.boolean(),
  })
}

type NotificationsFormValues = z.infer<ReturnType<typeof makeSchema>>

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
  const { t } = useTranslation()
  const update = useUpdateSettings()
  const schema = useMemo(() => makeSchema(t), [t])

  // Hydrate defaults from the stored KV notifications section (D-06) — this
  // component only mounts once `data` is present, so the form never flashes a
  // pre-GET hardcoded value.
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(schema),
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
      onSuccess: () => toast.success(t('settings.notifications.updated')),
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
              <FormLabel>{t('settings.notifications.notifyAbout')}</FormLabel>
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
                      {t('settings.notifications.all')}
                    </FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center'>
                    <FormControl>
                      <RadioGroupItem value='mentions' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      {t('settings.notifications.mentions')}
                    </FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center'>
                    <FormControl>
                      <RadioGroupItem value='none' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      {t('settings.notifications.none')}
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='relative'>
          <h3 className='mb-4 text-lg font-medium'>
            {t('settings.notifications.emailTitle')}
          </h3>
          <div className='space-y-4'>
            <FormField
              control={form.control}
              name='communication_emails'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('settings.notifications.communicationLabel')}
                    </FormLabel>
                    <FormDescription>
                      {t('settings.notifications.communicationDesc')}
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
                      {t('settings.notifications.marketingLabel')}
                    </FormLabel>
                    <FormDescription>
                      {t('settings.notifications.marketingDesc')}
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
                    <FormLabel className='text-base'>
                      {t('settings.notifications.socialLabel')}
                    </FormLabel>
                    <FormDescription>
                      {t('settings.notifications.socialDesc')}
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
                    <FormLabel className='text-base'>
                      {t('settings.notifications.securityLabel')}
                    </FormLabel>
                    <FormDescription>
                      {t('settings.notifications.securityDesc')}
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
                <FormLabel>{t('settings.notifications.mobileLabel')}</FormLabel>
                <FormDescription>
                  {t('settings.notifications.mobileDescPrefix')}
                  <Link
                    to='/settings'
                    className='underline decoration-dashed underline-offset-4 hover:decoration-solid'
                  >
                    {t('settings.notifications.mobileDescLink')}
                  </Link>
                  {t('settings.notifications.mobileDescSuffix')}
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <Button type='submit'>{t('settings.notifications.submit')}</Button>
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
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>{t('settings.notifications.loadError')}</AlertTitle>
        <AlertDescription>
          {t('settings.common.loadErrorDesc')}
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        {t('settings.common.retry')}
      </Button>
    </div>
  )
}
