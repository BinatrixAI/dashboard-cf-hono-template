import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentSection } from '../components/content-section'

export function SettingsProfile() {
  // TODO(Phase 3): reconcile with Clerk — replace this static placeholder with
  // the Clerk <UserProfile> component once Clerk auth is wired.
  return (
    <ContentSection
      title='Profile'
      desc='This is how others will see you on the site.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Your profile details will appear here after Clerk is connected. (Phase
          3)
        </CardContent>
      </Card>
    </ContentSection>
  )
}
