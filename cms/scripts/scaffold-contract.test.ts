// Offline static-assertion self-check for the Phase 14 CMS scaffold contract.
// Run: npx tsx cms/scripts/scaffold-contract.test.ts
// Mirrors the seed-admin.test.ts convention (plain node:assert, no wrangler/D1/network).
// Covers CMS-01 (isolated package + exact pin + three bindings), CMS-04 (blog-posts
// collection registered, public read-only, core siteSettingsCollection alongside it),
// and CMS-05 (mcpPlugin() + redirectPlugin wired in code AND documented).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cmsDir = path.join(__dirname, '..')
const repoRoot = path.join(cmsDir, '..')

function read(relToCms: string): string {
  return readFileSync(path.join(cmsDir, relToCms), 'utf8')
}

async function main() {
  // --- CMS-01: exact pin + isolated package + three bindings ---
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dashboard-cf-hono-template-cms', 'cms/ must be its own package, not the root')
  assert.equal(
    pkg.dependencies['@sonicjs-cms/core'],
    '3.0.0-beta.24',
    'must be an EXACT pin (no ^ or ~) on @sonicjs-cms/core@3.0.0-beta.24',
  )

  const wrangler = read('wrangler.jsonc')
  assert.match(wrangler, /"main":\s*"\.\/src\/index\.ts"/, 'cms must have its own wrangler.jsonc entry')
  assert.match(wrangler, /"binding":\s*"DB"/, 'must declare the DB (D1) binding')
  assert.match(wrangler, /"binding":\s*"MEDIA_BUCKET"/, 'must declare the MEDIA_BUCKET (R2) binding')
  assert.match(wrangler, /"binding":\s*"CACHE_KV"/, 'must declare the CACHE_KV (KV) binding')

  // --- CMS-04: blog-posts collection ---
  const blogPosts = read('src/collections/blog-posts.collection.ts')
  assert.match(blogPosts, /slug:\s*'blog-posts'/, 'collection slug contract must be blog-posts')
  assert.match(
    blogPosts,
    /access:\s*\{\s*public:\s*\[\s*'read'\s*\]\s*\}/,
    'collection must grant public read-only access (no public write verb)',
  )
  // No public write verb: the public array must be exactly ['read'], never contain create/update/delete.
  const publicArrayMatch = blogPosts.match(/public:\s*\[([^\]]*)\]/)
  assert.ok(publicArrayMatch, 'public access array must be present')
  assert.doesNotMatch(
    publicArrayMatch![1],
    /create|update|delete|write/,
    'public access must not include any write verb',
  )

  const index = read('src/index.ts')
  assert.match(index, /import blogPostsCollection from '\.\/collections\/blog-posts\.collection'/,
    'index.ts must import the blog-posts collection')
  assert.match(index, /siteSettingsCollection/, 'index.ts must import/register core siteSettingsCollection')
  assert.match(
    index,
    /registerCollections\(\[\s*siteSettingsCollection,\s*blogPostsCollection\s*\]\)/,
    'both collections must be registered together',
  )

  // --- CMS-05: mcpPlugin() + redirectPlugin wired in code AND documented ---
  assert.match(index, /redirectPlugin/, 'index.ts must reference redirectPlugin')
  assert.match(index, /mcpPlugin\(\)/, 'index.ts must call mcpPlugin()')
  assert.match(
    index,
    /register:\s*\[redirectPlugin,\s*mcpPlugin\(\)\]/,
    'both plugins must be registered in the plugins.register array',
  )

  const docs = readFileSync(path.join(repoRoot, 'docs/cms.md'), 'utf8')
  assert.match(docs, /redirectPlugin/, 'docs/cms.md must document redirectPlugin')
  assert.match(docs, /mcpPlugin/, 'docs/cms.md must document mcpPlugin')

  console.log('scaffold-contract self-check: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
