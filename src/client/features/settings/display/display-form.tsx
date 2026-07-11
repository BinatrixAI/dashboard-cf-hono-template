import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  useSettings,
  useUpdateSettings,
} from '@/features/settings/data/use-settings'
import { type AppSettings } from '../../../../shared/settings'

// `label` fields hold translation KEYS — t() is called at render (G2), never
// here at module scope where it would freeze the initial language.
const items = [
  {
    id: 'recents',
    label: 'settings.display.items.recents',
  },
  {
    id: 'home',
    label: 'settings.display.items.home',
  },
  {
    id: 'applications',
    label: 'settings.display.items.applications',
  },
  {
    id: 'desktop',
    label: 'settings.display.items.desktop',
  },
  {
    id: 'downloads',
    label: 'settings.display.items.downloads',
  },
  {
    id: 'documents',
    label: 'settings.display.items.documents',
  },
] as const

// The `.refine(non-empty)` is a FORM-level UX validation ("select at least one
// item"); the server section is a plain `z.array(z.string())`. A non-empty array
// validates against both, so `DisplayFormValues` ({ items: string[] }) is assignable
// to `AppSettings['display']` with no transform (D-03). Message comes from t()
// via makeSchema(t) + useMemo (G2, no module-scope t()).
function makeSchema(t: TFunction) {
  return z.object({
    items: z.array(z.string()).refine((value) => value.some((item) => item), {
      message: t('settings.display.minOne'),
    }),
  })
}

type DisplayFormValues = z.infer<ReturnType<typeof makeSchema>>

// Load gate (D-06 / Pitfall 2): never render or save hardcoded defaults before
// the stored KV blob resolves. Mirrors the `items/index.tsx` isPending/isError
// idiom — only the resolved-data branch mounts the editable form.
export function DisplayForm() {
  const { data, isPending, isError, refetch } = useSettings()

  if (isPending) return <DisplayFormSkeleton />
  if (isError) return <DisplayFormError onRetry={() => refetch()} />

  return <DisplayFormFields data={data} />
}

function DisplayFormFields({ data }: { data: AppSettings }) {
  const { t } = useTranslation()
  const update = useUpdateSettings()
  const schema = useMemo(() => makeSchema(t), [t])

  // Hydrate the item selection from the stored KV display section (D-06) — this
  // component only mounts once `data` is present, so the checkboxes never flash a
  // pre-GET hardcoded selection.
  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: data.display.items,
    },
  })

  function onSubmit(values: DisplayFormValues) {
    // Merge only the display section into the full cached blob and PUT the whole
    // document (D-05, Pitfall 1) — never a partial that drops siblings.
    const next: AppSettings = { ...data, display: values }
    update.mutate(next, {
      onSuccess: () => toast.success(t('settings.display.updated')),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='items'
          render={() => (
            <FormItem>
              <div className='mb-4'>
                <FormLabel className='text-base'>
                  {t('settings.display.sidebarLabel')}
                </FormLabel>
                <FormDescription>
                  {t('settings.display.sidebarDesc')}
                </FormDescription>
              </div>
              {items.map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name='items'
                  render={({ field }) => {
                    return (
                      <FormItem
                        key={item.id}
                        className='flex flex-row items-start'
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, item.id])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== item.id
                                    )
                                  )
                            }}
                          />
                        </FormControl>
                        <FormLabel className='font-normal'>
                          {t(item.label)}
                        </FormLabel>
                      </FormItem>
                    )
                  }}
                />
              ))}
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>{t('settings.display.submit')}</Button>
      </form>
    </Form>
  )
}

function DisplayFormSkeleton() {
  return (
    <div className='space-y-8'>
      <div className='space-y-2'>
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-4 w-72' />
      </div>
      <div className='space-y-3'>
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-5 w-28' />
        <Skeleton className='h-5 w-28' />
      </div>
      <Skeleton className='h-9 w-36' />
    </div>
  )
}

function DisplayFormError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>{t('settings.display.loadError')}</AlertTitle>
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
