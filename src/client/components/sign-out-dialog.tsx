import { useClerk } from '@clerk/react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { signOut } = useClerk()
  const { t } = useTranslation()

  const handleSignOut = () => {
    // Clears the Clerk client + __session cookie and lands on the public
    // landing route, not the sign-in page (D-09).
    void signOut({ redirectUrl: '/' })
    onOpenChange(false)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profileDropdown.signOut')}
      desc={t('common.signOutDesc')}
      confirmText={t('profileDropdown.signOut')}
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
