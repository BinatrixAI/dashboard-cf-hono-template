import { Separator } from '@/components/ui/separator'

type ContentSectionProps = {
  title: string
  desc: string
  children: React.JSX.Element
  /**
   * Opt out of the `lg:max-w-xl` width cap on the inner wrapper. Multi-tab
   * widgets (e.g. Clerk `<UserProfile/>`) need full width; the four default
   * settings pages keep the narrow cap (default `false`).
   */
  fullWidth?: boolean
}

export function ContentSection({
  title,
  desc,
  children,
  fullWidth = false,
}: ContentSectionProps) {
  return (
    <div className='flex flex-1 flex-col'>
      <div className='flex-none'>
        <h3 className='text-lg font-medium'>{title}</h3>
        <p className='text-muted-foreground text-sm'>{desc}</p>
      </div>
      <Separator className='my-4 flex-none' />
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className={fullWidth ? '-mx-1 px-1.5' : '-mx-1 px-1.5 lg:max-w-xl'}>
          {children}
        </div>
      </div>
    </div>
  )
}
