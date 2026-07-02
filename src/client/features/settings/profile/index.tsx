import { UserProfile } from '@clerk/react'
import { ContentSection } from '../components/content-section'

export function SettingsProfile() {
  return (
    <ContentSection
      title='Profile'
      desc='This is how others will see you on the site.'
      fullWidth
    >
      {/*
        Theme is inherited from the global <ClerkProvider appearance={{ theme: shadcn }}>
        in main.tsx (D-03) — no per-component appearance. `routing="hash"` lets the
        widget self-navigate its tabs via location.hash with zero new TanStack routes
        (D-02); it also makes a `path` prop a type error. RTL is DOM-`<html dir>`-driven
        via direction-provider.tsx — Clerk exposes no dir/rtl prop (D-08).
      */}
      <UserProfile routing='hash' />
    </ContentSection>
  )
}
