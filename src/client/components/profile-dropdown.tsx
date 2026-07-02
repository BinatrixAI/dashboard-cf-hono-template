import { Link } from '@tanstack/react-router'
import { useUser } from '@clerk/react'
import { initialsFromUser } from '@/lib/initials'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const { user } = useUser()

  // Real Clerk identity in the header user menu (D-08); shadcn chrome intact.
  const name = user?.fullName ?? user?.firstName ?? 'Account'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const avatar = user?.imageUrl ?? ''
  // Derived from the current session identity, not a hardcoded placeholder (D-06a).
  const initials = initialsFromUser(user)

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>{name}</p>
              <p className='text-muted-foreground text-xs leading-none'>
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {/* Single canonical entry into the Clerk user area (D-06). Collapses the
                former Profile + Settings pair that both dumped onto /settings
                (RESEARCH Pitfall 4 — no two rows to the same route). */}
            <DropdownMenuItem asChild>
              <Link to='/settings'>
                Manage account
                <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            {/* TODO(forker): re-enable Billing once a real billing route exists (D-07).
            <DropdownMenuItem asChild>
              <Link to='/settings'>
                Billing
                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            */}
            {/* TODO(forker): re-enable New Team once Organizations/Teams are wired (D-07).
            <DropdownMenuItem>New Team</DropdownMenuItem>
            */}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            Sign out
            <DropdownMenuShortcut className='text-current'>
              ⇧⌘Q
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
