import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/react'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/(auth)/sign-up')({
  component: () => (
    <SignUp
      forceRedirectUrl='/dashboard'
      fallback={<Skeleton className='h-[30rem] w-[25rem]' />}
    />
  ),
})
