import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** (i) button with a tooltip note; carries its own provider so it works outside the sidebar layout. */
export function InfoTip({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={t('infoTip.label')}
            className='focus-ring inline-flex size-6 shrink-0 items-center justify-center rounded-full'
          >
            <Info aria-hidden className='text-muted-foreground size-3.5' />
          </button>
        </TooltipTrigger>
        <TooltipContent className='max-w-[280px] text-sm'>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
