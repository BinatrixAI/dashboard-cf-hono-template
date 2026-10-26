import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type RecentSale } from '../data/mock'

/** Derive 2-char uppercase initials from a full name (static mock data). */
function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Recent Sales avatar list. The surrounding Card/title/description are supplied
 * by the shell (Plan 04) — this renders just the row list. Avatar images point
 * at `/avatars/*` assets that do not exist in the template, so every row falls
 * through to `AvatarFallback` initials by design (DV-11).
 */
export function RecentSales({ data }: { data: RecentSale[] }) {
  return (
    <div className='space-y-8'>
      {data.map((sale) => (
        <div key={sale.email} className='flex items-center gap-4'>
          <Avatar className='size-9'>
            <AvatarImage src={`/avatars/${sale.email}.png`} alt={sale.name} />
            <AvatarFallback>{initials(sale.name)}</AvatarFallback>
          </Avatar>
          <div className='space-y-1'>
            <p className='text-sm'>
              <span dir='auto'>{sale.name}</span>
            </p>
            <p className='text-muted-foreground text-xs'>
              <span dir='auto'>{sale.email}</span>
            </p>
          </div>
          <div dir='ltr' className='ms-auto text-sm'>
            {sale.amount}
          </div>
        </div>
      ))}
    </div>
  )
}
