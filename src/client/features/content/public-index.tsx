import type * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { lexicalToPlainText } from './data/lexical-text'
import type { ContentItem } from './data/schema'
import { useContent } from './data/use-content'

// PUB-01 public blog index — reader cards over the cached `useContent()` list
// (D-03). Clerk-free: no dashboard chrome, no session import. All states carry
// neutral reader copy — never an env-var name or docs link (D-05); an
// unconfigured CMS reads as loading->empty, indistinguishable from zero posts.
export function PublicIndex() {
  const { data, isPending, isError, refetch } = useContent()

  if (isPending) return <IndexLoading />
  if (isError) return <IndexError onRetry={() => refetch()} />
  if (data.length === 0) return <IndexEmpty />

  const posts = [...data].sort((a, b) => sortKey(b) - sortKey(a))
  return (
    <div className='space-y-4'>
      {posts.map((post) => {
        const slug = post.slug ?? post.id
        // ponytail: /blog/$slug is registered by Plan 02's route files. Until
        // those exist the generated route tree lacks the literal, so the typed
        // Link can't see it. Widen at this single boundary — the target becomes
        // real in Plan 02, and a widening cast (not @ts-expect-error) stays
        // valid afterwards. Slug-or-id key matches findPost so the link resolves.
        const linkProps = {
          to: '/blog/$slug',
          params: { slug },
        } as unknown as React.ComponentProps<typeof Link>
        return (
          <Link
            key={post.id}
            {...linkProps}
            className='block rounded-lg transition-opacity hover:opacity-80'
          >
            <Card>
              <CardHeader>
                <CardTitle className='text-xl font-semibold'>
                  {post.title}
                </CardTitle>
                <p className='text-muted-foreground text-sm'>
                  {formatPublished(post.data?.publishedAt, post.created_at)}
                </p>
              </CardHeader>
              <CardContent>
                {/* React escapes text children — plaintext only, CSS-native
                    line-clamp truncation, no injected ellipsis (T-16-01). */}
                <p className='text-muted-foreground text-sm line-clamp-3'>
                  {lexicalToPlainText(post.data?.content)}
                </p>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

// Newest first: prefer a parsable publishedAt, else the ms-epoch created_at.
function sortKey(item: ContentItem): number {
  const published = item.data?.publishedAt
  const parsed = published ? Date.parse(published) : NaN
  return Number.isNaN(parsed) ? (item.created_at ?? 0) : parsed
}

function formatPublished(
  publishedAt: string | null | undefined,
  createdAt: number | undefined
): string {
  const value = publishedAt ?? createdAt
  if (value === null || value === undefined) return 'Unpublished'
  return new Date(value).toLocaleDateString()
}

function IndexLoading() {
  return (
    <div className='space-y-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-6 w-2/3' />
            <Skeleton className='h-4 w-24' />
          </CardHeader>
          <CardContent className='space-y-2'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-5/6' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function IndexEmpty() {
  return (
    <div className='flex flex-col items-center gap-2 py-12 text-center'>
      <h2 className='text-xl font-semibold'>No posts yet</h2>
      <p className='text-muted-foreground text-sm'>Check back soon.</p>
    </div>
  )
}

function IndexError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className='flex flex-col items-center gap-3 py-12 text-center'>
      <Alert variant='destructive' className='text-left'>
        <AlertTitle>Couldn't load posts</AlertTitle>
        <AlertDescription>
          Something went wrong loading the blog. Please try again.
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
