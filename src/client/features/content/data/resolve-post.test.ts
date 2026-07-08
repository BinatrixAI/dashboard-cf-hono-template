// Browser globals are NOT enabled in the node-env `client` vitest project, so
// import every test helper explicitly (see vitest.config.ts `client` project).
import { describe, it, expect } from 'vitest'
import { findPost } from './resolve-post'
import type { ContentItem } from './schema'

const post = (over: Partial<ContentItem> & { id: string }): ContentItem => ({
  title: '(untitled)',
  ...over,
})

describe('findPost', () => {
  it('matches by slug', () => {
    const posts = [
      post({ id: 'a', slug: 'hello' }),
      post({ id: 'b', slug: 'world' }),
    ]
    expect(findPost(posts, 'world')?.id).toBe('b')
  })

  it('falls back to id when no slug matches', () => {
    const posts = [post({ id: 'a', slug: 'hello' }), post({ id: 'b' })]
    expect(findPost(posts, 'b')?.id).toBe('b')
  })

  it('returns undefined on a clean miss', () => {
    const posts = [post({ id: 'a', slug: 'hello' })]
    expect(findPost(posts, 'nope')).toBeUndefined()
  })

  it('prefers a slug match over an id match on the same key', () => {
    const idMatch = post({ id: 'shared' })
    const slugMatch = post({ id: 'other', slug: 'shared' })
    const posts = [idMatch, slugMatch]
    expect(findPost(posts, 'shared')?.id).toBe('other')
  })
})
