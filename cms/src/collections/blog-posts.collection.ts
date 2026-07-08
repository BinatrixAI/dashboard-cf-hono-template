import type { CollectionConfig } from '@sonicjs-cms/core'

/**
 * Example brand-neutral `blog-posts` collection (CMS-04, D-10).
 *
 * The `slug: 'blog-posts'` value is the API-route CONTRACT that Phases 15/16
 * depend on (`GET /api/blog-posts`) — do NOT rename or narrow it.
 *
 * `access: { public: ['read'] }` opts the public into READ ONLY. Without this
 * key the collection is deny-by-default for unauthenticated visitors (only
 * `admin`/`editor` get grants in beta.24); all write verbs stay authenticated.
 */
const blogPostsCollection: CollectionConfig = {
  name: 'blog_post',
  displayName: 'Blog Post',
  slug: 'blog-posts',
  managed: true,
  isActive: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title', required: true, maxLength: 200 },
      slug: { type: 'slug', title: 'Slug', required: true, maxLength: 200 },
      content: { type: 'lexical', title: 'Content', required: true },
      author: { type: 'user', title: 'Author', required: true },
      publishedAt: { type: 'datetime', title: 'Published At' },
    },
    required: ['title', 'slug', 'content', 'author'],
  },
  listFields: ['title', 'author', 'status', 'publishedAt'],
  searchFields: ['title', 'content', 'author'],
  defaultSort: 'createdAt',
  defaultSortOrder: 'desc',
  access: {
    public: ['read'],
  },
}

export default blogPostsCollection
