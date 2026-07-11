import type * as React from 'react'
import { Link } from '@tanstack/react-router'
import { type TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { lexicalToPlainText } from './data/lexical-text'
import { findPost } from './data/resolve-post'
import { useContent } from './data/use-content'

// PUB-01 public post page (D-02/D-04/D-05). Sources the SAME cached useContent()
// list the index warms — react-query dedups — then resolves client-side with
// findPost; there is no by-slug endpoint (RESEARCH Pitfall 1), so the single-item
// query is intentionally unused. Body renders as React-escaped plaintext, never a
// raw-HTML sink (T-16-01). No status Badge (everything public is published), no
// Clerk/dashboard chrome, neutral reader copy only (D-05).
export function PublicDetail({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useContent()

  if (isPending) return <DetailLoading />
  if (isError) return <DetailError onRetry={() => refetch()} />

  const post = findPost(data, slug)
  // Distinct from the fetch-error state (Open Q2): a successful fetch with no
  // slug match is "not found", not "couldn't load".
  if (!post) return <PostNotFound />

  return (
    <article className='space-y-6'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>{post.title}</h1>
        <p className='text-muted-foreground text-sm'>
          {formatPublished(post.data?.publishedAt, post.created_at, t)}
        </p>
      </div>
      {/* React escapes text children — plaintext only, never innerHTML. */}
      <p className='leading-relaxed whitespace-pre-wrap'>
        {lexicalToPlainText(post.data?.content)}
      </p>
    </article>
  )
}

function formatPublished(
  publishedAt: string | null | undefined,
  createdAt: number | undefined,
  t: TFunction
): string {
  const value = publishedAt ?? createdAt
  if (value === null || value === undefined) return t('content.unpublished')
  return new Date(value).toLocaleDateString()
}

function DetailLoading() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-2/3' />
        <Skeleton className='h-4 w-24' />
      </div>
      <Skeleton className='h-40 w-full' />
    </div>
  )
}

function DetailError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col items-center gap-3 py-12 text-center'>
      <Alert variant='destructive' className='text-left'>
        <AlertTitle>{t('content.public.errorTitle')}</AlertTitle>
        <AlertDescription>{t('content.public.errorBody')}</AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        {t('content.retry')}
      </Button>
    </div>
  )
}

function PostNotFound() {
  const { t } = useTranslation()
  // ponytail: /blog is registered by Plan 02's route files. Until those exist
  // the generated route tree lacks the literal, so the typed Link can't see it.
  // Widen at this single boundary — the target becomes real in Plan 02, and a
  // widening cast (not @ts-expect-error) stays valid afterwards.
  const backLink = { to: '/blog' } as unknown as React.ComponentProps<
    typeof Link
  >
  return (
    <div className='flex flex-col items-center gap-2 py-12 text-center'>
      <h1 className='text-xl font-semibold'>
        {t('content.public.notFoundTitle')}
      </h1>
      <p className='text-muted-foreground text-sm'>
        {t('content.public.notFoundBody')}
      </p>
      <Link {...backLink} className='text-sm hover:underline'>
        {t('content.public.back')}
      </Link>
    </div>
  )
}
