import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { fonts } from '@/config/fonts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useFont } from '@/context/font-provider'
import { useTheme } from '@/context/theme-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
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
import {
  useSettings,
  useUpdateSettings,
} from '@/features/settings/data/use-settings'
import { type AppSettings } from '../../../../shared/settings'

const appearanceFormSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  font: z.enum(fonts),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

// Load gate (D-06 / Pitfall 2): never render or save hardcoded defaults before
// the stored KV blob resolves. Mirrors the `items/index.tsx` isPending/isError
// idiom — only the resolved-data branch mounts the editable form.
export function AppearanceForm() {
  const { data, isPending, isError, refetch } = useSettings()

  if (isPending) return <AppearanceFormSkeleton />
  if (isError) return <AppearanceFormError onRetry={() => refetch()} />

  return <AppearanceFormFields data={data} />
}

function AppearanceFormFields({ data }: { data: AppSettings }) {
  const { setFont } = useFont()
  const { setTheme } = useTheme()
  const update = useUpdateSettings()

  // Hydrate defaults from the stored KV appearance section (D-06) — this component
  // only mounts once `data` is present, so the form never flashes a pre-GET value.
  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: data.appearance.theme,
      font: data.appearance.font,
    },
  })

  function onSubmit(values: AppearanceFormValues) {
    // Instant apply via cookie write-through (D-09, no FOUC) — only when changed.
    if (values.font !== data.appearance.font) setFont(values.font)
    if (values.theme !== data.appearance.theme) setTheme(values.theme)

    // Merge only the appearance section into the full cached blob and PUT the
    // whole document (D-05, Pitfall 1) — never a partial that drops siblings.
    const next: AppSettings = { ...data, appearance: values }
    update.mutate(next, {
      onSuccess: () => toast.success('Preferences updated'),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='font'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font</FormLabel>
              <div className='relative w-max'>
                <FormControl>
                  <select
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'w-[200px] appearance-none font-normal capitalize',
                      'dark:bg-background dark:hover:bg-background'
                    )}
                    {...field}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <ChevronDownIcon className='absolute end-3 top-2.5 h-4 w-4 opacity-50' />
              </div>
              <FormDescription className='font-manrope'>
                Set the font you want to use in the dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='theme'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme</FormLabel>
              <FormDescription>
                Select the theme for the dashboard.
              </FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className='grid max-w-2xl grid-cols-1 gap-6 pt-2 sm:grid-cols-3'
              >
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary'>
                    <FormControl>
                      <RadioGroupItem value='light' className='sr-only' />
                    </FormControl>
                    <div className='border-muted hover:border-accent items-center rounded-md border-2 p-1'>
                      <div className='space-y-2 rounded-sm bg-[#ecedef] p-2'>
                        <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-2 w-[80px] rounded-lg bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      Light
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary'>
                    <FormControl>
                      <RadioGroupItem value='dark' className='sr-only' />
                    </FormControl>
                    <div className='border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1'>
                      <div className='space-y-2 rounded-sm bg-slate-950 p-2'>
                        <div className='space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-2 w-[80px] rounded-lg bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      Dark
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary'>
                    <FormControl>
                      <RadioGroupItem value='system' className='sr-only' />
                    </FormControl>
                    <div className='border-muted hover:border-accent items-center rounded-md border-2 p-1'>
                      <div className='grid grid-cols-2 overflow-hidden rounded-sm'>
                        {/* Light half — mirrors the Light card idiom */}
                        <div className='space-y-2 bg-[#ecedef] p-2'>
                          <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
                            <div className='h-2 w-full rounded-lg bg-[#ecedef]' />
                            <div className='h-2 w-full rounded-lg bg-[#ecedef]' />
                          </div>
                          <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                            <div className='h-4 w-4 rounded-full bg-[#ecedef]' />
                            <div className='h-2 w-full rounded-lg bg-[#ecedef]' />
                          </div>
                        </div>
                        {/* Dark half — mirrors the Dark card idiom */}
                        <div className='space-y-2 bg-slate-950 p-2'>
                          <div className='space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                            <div className='h-2 w-full rounded-lg bg-slate-400' />
                            <div className='h-2 w-full rounded-lg bg-slate-400' />
                          </div>
                          <div className='flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                            <div className='h-4 w-4 rounded-full bg-slate-400' />
                            <div className='h-2 w-full rounded-lg bg-slate-400' />
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      System
                    </span>
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormItem>
          )}
        />

        <Button type='submit'>Update preferences</Button>
      </form>
    </Form>
  )
}

function AppearanceFormSkeleton() {
  return (
    <div className='space-y-8'>
      <div className='space-y-2'>
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-9 w-[200px]' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='h-4 w-16' />
        <div className='grid max-w-2xl grid-cols-1 gap-6 pt-2 sm:grid-cols-3'>
          <Skeleton className='h-[148px] w-full' />
          <Skeleton className='h-[148px] w-full' />
          <Skeleton className='h-[148px] w-full' />
        </div>
      </div>
      <Skeleton className='h-9 w-40' />
    </div>
  )
}

function AppearanceFormError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>Could not load appearance settings</AlertTitle>
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
