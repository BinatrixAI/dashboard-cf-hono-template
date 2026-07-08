import {
  createSonicJSApp,
  registerCollections,
  siteSettingsCollection,
  redirectPlugin,
  mcpPlugin,
} from '@sonicjs-cms/core'
import type { SonicJSConfig } from '@sonicjs-cms/core'
import blogPostsCollection from './collections/blog-posts.collection'

/**
 * CMS Worker entry (referenced by wrangler.jsonc `main`).
 *
 * The app body is owned by `@sonicjs-cms/core` — this file only wires the
 * brand-neutral registry and enables the two differentiator plugins.
 *
 * Register ONLY these two collections. Upstream also registers three demo
 * collections/plugins — all omitted for brand-neutrality (D-10).
 * `siteSettingsCollection` is `internal: true` (admin-only); `blogPostsCollection`
 * is public-readable.
 */
registerCollections([siteSettingsCollection, blogPostsCollection])

/**
 * `redirectPlugin` is a const (do NOT call it); `mcpPlugin()` IS called
 * (optional config defaulted). Both enabled — CMS-05.
 *
 * beta.24 types `plugins.register` as `Plugin[]`, but the plugin factories return
 * the newer `DefinedPlugin` shape (`routes[].handler: unknown`). Upstream ships
 * this exact wiring at runtime; the cast to the config's own declared element type
 * bridges the stale type. ponytail: drop when core widens `register` to accept
 * `DefinedPlugin`.
 */
const app = createSonicJSApp({
  plugins: {
    register: [redirectPlugin, mcpPlugin()] as NonNullable<
      SonicJSConfig['plugins']
    >['register'],
    disableAll: false,
  },
})

// Fetch-only default export — neither enabled plugin declares crons, so no
// `scheduled` handler is needed (add one only if a cron-declaring plugin lands).
export default { fetch: app.fetch }
