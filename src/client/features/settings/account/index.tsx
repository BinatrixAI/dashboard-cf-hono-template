import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentSection } from '../components/content-section'

export function SettingsAccount() {
  // TODO(Phase 3): reconcile with Clerk — replace this static placeholder with
  // Clerk account management (<UserButton> / account page) once Clerk is wired.
  return (
    <ContentSection
      title='Account'
      desc='Update your account settings. Set your preferred language and
          timezone.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Account management will be available after Clerk is connected. (Phase
          3)
        </CardContent>
      </Card>
    </ContentSection>
  )
}
