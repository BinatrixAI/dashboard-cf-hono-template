// setup.mjs — one-shot project parameterization CLI for the dashboard-cf-hono-template.
//
// Run with:  node setup.mjs            (interactive on a TTY)
//            node setup.mjs --yes …    (headless / CI — never prompts)
//
// WHAT IT DOES (SETUP-01 + SETUP-05, and SETUP-02 — .dev.vars + creation checklist):
//   1. Resolves each project value by precedence: explicit flag → env → (prompt only on a
//      TTY and without --yes) → default. The isTTY guard is load-bearing: in a non-TTY/CI
//      stdin the script NEVER calls rl.question (it would hang or EOF), it falls straight
//      through to flags/env/defaults.
//   2. Refuses to run twice: if `.setup-complete` exists and --force is absent it exits
//      non-zero BEFORE touching any file (idempotency guard, D-11).
//   3. Substitutes every value-bearing `__NAME__` identifier sentinel into project-specific
//      values across a fixed file-set. wrangler.jsonc is field-targeted (the `__D1_BINDING__`
//      token means TWO different things there — code `binding` "DB" vs the real
//      `database_name` — so a blind replaceAll would corrupt the deployed D1 name, Pitfall 1).
//   4. Runs a BLOCKING leftover-sentinel scan: any surviving identifier sentinel hard-fails
//      (exit non-zero, lists file:line). The `REPLACE_WITH_YOUR_*` resource-ID placeholders
//      are NOT failures — the user fills them after `wrangler … create`, so they are reported
//      as non-blocking outstanding actions (Open Question 1).
//   5. Generates `.dev.vars` from `.dev.vars.example`, pre-filling the Clerk PUBLISHABLE
//      key into both publishable assignments and leaving CLERK_SECRET_KEY empty (the secret
//      is checklist-only). An existing `.dev.vars` is backed up to `.dev.vars.bak` first.
//   6. On a clean scan writes the `.setup-complete` marker (ISO-timestamped), prints a
//      per-account creation checklist (sanitized `wrangler d1/kv create`, `wrangler secret
//      put`, `pnpm cf-typegen`), and EXITS — it does NOT delete itself, so a later re-run
//      (e.g. theme re-swap) stays possible (D-11 supersedes ROADMAP success-criterion 5).
//
// Zero-dependency: Node ≥ 22 stdlib only (node:util parseArgs, node:readline/promises,
// node:process, node:fs, node:path, node:url) + global fetch (consumed by a later slice).
// This file is itself EXEMPT from the leftover scan (it legitimately contains the sentinel
// literals it searches for).

import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants — the substitution + scan contract. EXEMPT_PATHS + SENTINEL_RE
// are the contract Phase 6 CICD-04 must reuse VERBATIM so the local self-check and
// the CI sentinel-grep can never disagree (D-10).
// ─────────────────────────────────────────────────────────────────────────────

// Files setup.mjs rewrites. wrangler.jsonc is field-targeted; all others use replaceAll.
export const SUBSTITUTION_FILESET = [
  'wrangler.jsonc',
  'cms/wrangler.jsonc',
  'package.json',
  'index.html',
  'src/client/components/layout/data/sidebar-data.ts',
  'src/server/routes/items.ts',
  'src/server/routes/settings.ts',
  'test/apply-migrations.ts',
  'test/env.d.ts',
  'worker-configuration.d.ts',
]

// Identifier sentinels (`__PKG_NAME__`, `__APP_NAME__`, `__D1_BINDING__`, `__KV_BINDING__`,
// `__NAME__`): two leading underscores, uppercase letters / digits / underscores, two
// trailing underscores. These MUST all be resolved at setup time → BLOCKING on any leftover.
export const HARD_FAIL_RE = /__[A-Z0-9_]+__/
// Cloudflare resource-ID placeholders the user fills AFTER creating D1/KV — NON-blocking.
export const REPLACE_RE = /REPLACE_WITH_YOUR_[A-Z0-9_]+/
// The union both forms — this is what Phase 6 CICD-04 greps for.
export const SENTINEL_RE = /__[A-Z0-9_]+__|REPLACE_WITH_YOUR_[A-Z0-9_]+/

// Path prefixes / exact files the scan must skip. setup.mjs and the toggle record carry
// sentinel literals by design; docs/.planning are narrative; the rest are build output.
export const EXEMPT_PATHS = [
  'docs/',
  '.planning/',
  'node_modules/',
  '.git/',
  'dist/',
  '.wrangler/',
  'setup.mjs',
  '.setup-config.json',
]

// Binding code-id defaults (D-04): fixed, NOT prompted. The prompted d1 name / kv title are
// SEPARATE values (wrangler.jsonc database_name + the resource-creation checklist in 05-02).
export const D1_BINDING = 'DB'
export const KV_BINDING = 'CACHE'

export const MARKER = '.setup-complete'

// Module-toggle record (SETUP-03 / D-12). The Phase-7 handoff seam: a gitignored,
// scan-exempt JSON record of the developer's module intent. Schema is LOCKED now
// (Open Question 2) — Phase 7 reads `asyncLayer` to uncomment the (then-present) async
// wrangler config; `integrationApi` is reserved for v2 and ALWAYS recorded false.
export const MODULE_CONFIG = '.setup-config.json'
export const MODULE_CONFIG_SCHEMA_VERSION = 1

// Theme swap contract (docs/THEMING.md "Phase-5 contract"). The shipped preset mirrors the
// live slate theme.css, so re-applying it is a provable no-op. Both paths are relative to the
// project root; loadPreset confines a local `--theme` path to this root (T-05-05).
export const SHIPPED_PRESET_REL = 'src/client/styles/tweakcn-preset.json'
export const THEME_CSS_REL = 'src/client/styles/theme.css'
// SSRF guard (T-05-03): a remote `--theme` may ONLY be an https tweakcn.com registry item.
const TWEAKCN_HOST = 'tweakcn.com'
// CSS-structure-injection guard (T-05-02): no legitimate oklch / var() / font value carries
// any of these, so a preset value containing one is rejected before it reaches the stylesheet.
const FORBIDDEN_CSS_VALUE_RE = /[{};]|\n/
// CSS-structure-injection guard (T-05-02, KEY side): a theme token key becomes a CSS custom-
// property segment (`--<key>`) AND a Tailwind utility (`--color-<key>`), so it must be a safe
// custom-property identifier. Restrict to lowercase-alphanumeric + hyphen — anything else
// (whitespace, `:`, `;`, `{`, `}`, newline, …) could break out of the declaration / selector.
const SAFE_CSS_KEY_RE = /^[a-z0-9-]+$/

// Input-validation shapes (V5 / ASVS L1). Worker name must be a single lowercase-alphanumeric
// token with internal hyphens (wrangler `name` rules — no underscores/uppercase). The Clerk
// publishable key must carry the publishable prefix (never a secret `sk_`).
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
// WR-03: anchor the FULL key shape, not just the prefix. A prefix-only test let
// `pk_test_abc"def` or `pk_test_abc\nEVIL=1` through, where the embedded quote corrupts
// wrangler.jsonc and the embedded newline injects an arbitrary .dev.vars line. Restrict the
// body to the base64url-ish charset Clerk keys actually use (no quotes/whitespace/newlines).
const PK_RE = /^pk_(test|live)_[A-Za-z0-9._-]+$/

// D-09: strict FQDN shape for `--custom-domain <host>`. A Cloudflare `custom_domain`
// route is a SPECIFIC hostname (wildcards belong to zone `routes`, not here), so require
// ≥1 dot and reject a bare single label. Same WR-03 rigor as PK_RE: the charset alone
// (lowercase-alphanumeric + internal hyphen, no leading/trailing hyphen) rejects scheme
// (`:`/`/`), path (`/`), wildcard (`*`), quotes, whitespace, and newline — none can reach
// the wrangler.jsonc write. Total ≤253, each label ≤63.
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/
export const isValidCustomDomain = (h) => typeof h === 'string' && HOSTNAME_RE.test(h)

// T-17-02: the two OPTIONAL cross-worker URL inputs (--cms-cors-origin / --cms-api-url) are
// NOT slugs — they are https origins that land in cms/wrangler.jsonc's CORS_ORIGINS string
// and (for the api-url) a .env.local line. Same WR-03 rigor as PK_RE / HOSTNAME_RE: an
// embedded double-quote would corrupt the JSONC write and an embedded newline/whitespace
// would inject an arbitrary env line. Accept ONLY '' OR a comma-separated list where every
// entry is a well-formed https:// URL over a charset with no quote / whitespace / newline
// (comma is the only allowed separator — CORS_ORIGINS is multi-origin, an api-url is the
// one-entry case).
export const isValidCmsOrigins = (v) => {
  if (typeof v !== 'string') return false
  if (v === '') return true
  if (/["\s]/.test(v)) return false // no quote / whitespace / newline anywhere
  return v.split(',').every((entry) => {
    if (entry === '') return false
    try {
      return new URL(entry).protocol === 'https:'
    } catch {
      return false
    }
  })
}

// WR-17-01: --cms-api-url is a SINGLE origin — the sole seam src/client/lib/cms-client.ts reads
// via `new URL(base)` — unlike --cms-cors-origin, which is legitimately multi-origin. Sharing
// isValidCmsOrigins let a comma-separated value pass and land verbatim (comma included) in
// .env.local's VITE_CMS_API_URL, where `new URL("https://a,https://b")` does NOT throw but
// parses to a garbage host. Reject the comma here too so it must be exactly one https origin.
export const isValidCmsApiUrl = (v) => {
  if (typeof v !== 'string') return false
  if (v === '') return true
  if (/["\s,]/.test(v)) return false // single origin only — no comma either
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for direct unit testing).
// ─────────────────────────────────────────────────────────────────────────────

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// D-11/D-12: pure slug-echo diff. Given a { label → raw } map, return the fields whose
// slug differs from the raw input as { label, from, to }. Null/undefined entries are
// skipped (a default-sourced field never echoes). The caller supplies ONLY user-supplied
// raw values (A4 lock) — this helper just diffs whatever it is given. No I/O.
export function computeSlugRewrites(rawByLabel) {
  const out = []
  for (const [label, raw] of Object.entries(rawByLabel)) {
    if (raw == null) continue
    const to = slugify(raw)
    if (to !== String(raw)) out.push({ label, from: String(raw), to })
  }
  return out
}

// Derive the kebab worker slug + package name from a project name, keeping the entered
// display string as appName. e.g. deriveNames('Acme Dash') →
//   { workerSlug: 'acme-dash', pkgName: 'acme-dash', appName: 'Acme Dash' }
export function deriveNames(projectName) {
  const slug = slugify(projectName)
  return { workerSlug: slug, pkgName: slug, appName: String(projectName).trim() }
}

// WR-04: appName is a free-form display string (spaces, apostrophes, Hebrew/RTL all legitimate)
// but it lands in two structured contexts. Escape per-context at substitution time so an
// ordinary name like "Bob's Dashboard" cannot break the generated TS or HTML.
//
// HTML text/attribute context (index.html <title> + content="…"): neutralize the markup-
// significant characters. Escaping `& < > " '` makes the value safe in both element text and
// double/single-quoted attributes.
export function htmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Single-quoted JS/TS string context (sidebar-data.ts → name: '…'): escape backslash, the
// single quote, and any line break so the literal cannot be terminated or broken across lines.
export function jsSingleQuoteEscape(s) {
  return String(s)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
}

function writeFileAtomic(fp, content) {
  // write-then-rename for crash safety (never leave a half-written tracked file).
  const tmp = `${fp}.setup-tmp`
  writeFileSync(tmp, content)
  renameSync(tmp, fp)
}

// ─────────────────────────────────────────────────────────────────────────────
// Input resolution (hybrid: flag → env → prompt-if-TTY → default).
// ─────────────────────────────────────────────────────────────────────────────

function ensureValid(value, validate, label) {
  if (validate && !validate(value)) {
    console.error(`Invalid value for "${label}": ${JSON.stringify(value)}`)
    process.exit(1)
  }
}

export async function resolveInputs(values, env, { interactive, rl }) {
  const resolve = async ({ flag, envKey, def, prompt, validate, transform }) => {
    const finalize = (raw) => (transform ? transform(raw) : raw)

    if (flag !== undefined) {
      const v = finalize(flag)
      ensureValid(v, validate, prompt)
      return v
    }
    if (envKey && env[envKey] != null && env[envKey] !== '') {
      const v = finalize(env[envKey])
      ensureValid(v, validate, prompt)
      return v
    }
    if (!interactive) {
      const v = finalize(def)
      ensureValid(v, validate, prompt)
      return v
    }
    // Interactive: re-prompt until valid (never reached in --yes / non-TTY runs).
    for (;;) {
      const ans = (await rl.question(`${prompt} [${def ?? ''}]: `)).trim()
      const v = finalize(ans || def)
      if (!validate || validate(v)) return v
      process.stdout.write('  invalid value; please try again.\n')
    }
  }

  const appName = await resolve({
    flag: values['app-name'],
    envKey: 'SETUP_APP_NAME',
    def: 'Dashboard App',
    prompt: 'Project display name',
  })
  const workerSlug = await resolve({
    flag: values.name,
    envKey: 'SETUP_NAME',
    def: slugify(appName),
    prompt: 'Worker / package slug',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  const clerkPk = await resolve({
    flag: values['clerk-pk'],
    envKey: 'SETUP_CLERK_PK',
    def: '',
    prompt: 'Clerk publishable key (pk_test_… / pk_live_…, optional now)',
    validate: (v) => v === '' || PK_RE.test(v),
  })
  // WR-02: d1Name is written verbatim into wrangler.jsonc's `database_name` while the
  // checklist slugifies it — so an un-sanitized value desynced config from the created
  // resource and a quote/newline could corrupt the JSONC. Slugify (same transform the
  // checklist uses) + SLUG_RE-validate up front so the stored database_name and the
  // `wrangler d1 create …` command are guaranteed identical and JSON/shell-safe.
  const d1Name = await resolve({
    flag: values['d1-name'],
    envKey: 'SETUP_D1_NAME',
    def: `${workerSlug}-db`,
    prompt: 'D1 database name',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  const kvTitle = await resolve({
    flag: values['kv-title'],
    envKey: 'SETUP_KV_TITLE',
    def: `${workerSlug}-cache`,
    prompt: 'KV namespace title',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })

  // CMS Worker resource names (SETUP-09 / D-01): auto-derived from the main worker slug so a
  // `--yes` fork parameterizes BOTH Workers with zero extra prompts. Each is overridable via a
  // --cms-* flag / SETUP_CMS_* env (D-02). Same slugify + SLUG_RE contract as the main names.
  const cmsName = await resolve({
    flag: values['cms-name'],
    envKey: 'SETUP_CMS_NAME',
    def: `${workerSlug}-cms`,
    prompt: 'CMS Worker name',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  const cmsD1Name = await resolve({
    flag: values['cms-d1-name'],
    envKey: 'SETUP_CMS_D1_NAME',
    def: `${workerSlug}-cms-db`,
    prompt: 'CMS D1 database name',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  const cmsR2Bucket = await resolve({
    flag: values['cms-r2-bucket'],
    envKey: 'SETUP_CMS_R2_BUCKET',
    def: `${workerSlug}-cms-media`,
    prompt: 'CMS R2 bucket name',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  const cmsKvTitle = await resolve({
    flag: values['cms-kv-title'],
    envKey: 'SETUP_CMS_KV_TITLE',
    def: `${workerSlug}-cms-cache`,
    prompt: 'CMS KV namespace title',
    transform: slugify,
    validate: (v) => SLUG_RE.test(v),
  })
  // OPTIONAL cross-worker origins (D-05): default '' and validated as https origins (NOT
  // slugified). When absent they fall through to the D-04 post-deploy checklist step — no
  // best-guess derivation (the *.workers.dev subdomain is unknowable at fork time).
  const cmsCorsOrigin = await resolve({
    flag: values['cms-cors-origin'],
    envKey: 'SETUP_CMS_CORS_ORIGIN',
    def: '',
    prompt: 'CMS CORS origin(s) (https, comma-separated, optional now)',
    validate: isValidCmsOrigins,
  })
  const cmsApiUrl = await resolve({
    flag: values['cms-api-url'],
    envKey: 'SETUP_CMS_API_URL',
    def: '',
    prompt: 'CMS API URL for VITE_CMS_API_URL (https, single origin, optional now)',
    validate: isValidCmsApiUrl,
  })

  return {
    workerSlug,
    pkgName: workerSlug,
    appName,
    clerkPk,
    d1Name,
    kvTitle,
    cmsName,
    cmsD1Name,
    cmsR2Bucket,
    cmsKvTitle,
    cmsCorsOrigin,
    cmsApiUrl,
    theme: values.theme,
  }
}

// Resolve the module toggles (SETUP-03 / D-12). The async-layer choice is RECORDED only —
// the wrangler async config does not exist until Phase 7, so nothing is flipped here. The
// integration-API toggle is a labeled v2 no-op that ALWAYS records false. Prompts ONLY on a
// real TTY; in a non-TTY / --yes run both default to false (headless safe — never blocks).
export async function resolveModuleChoices({ interactive, rl }) {
  let asyncLayer = false
  if (interactive && rl) {
    const ans = (
      await rl.question('Enable the dormant async layer (Cron → Queues → Resend) config? [y/N]: ')
    ).trim()
    asyncLayer = /^(y|yes)$/i.test(ans)
  }
  // integration-API is presented as a v2 no-op below (printModuleNote) and is never enableable
  // this milestone — its directory does not exist yet, so the stored value is forced false.
  return { asyncLayer, integrationApi: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Substitution engine.
// ─────────────────────────────────────────────────────────────────────────────

// D-07/D-08: uncomment + fill the dormant `routes` line in wrangler.jsonc (custom-domain).
// TWO anchored `.replace` calls in substitute()'s style (NEVER JSON.parse): (1) add the
// trailing comma after the last active `"vars"` field; (2) strip the leading `// ` and fill
// the host into the placeholder in one shot. Applied ONLY when a host is set, so the no-flag
// path is byte-stable (D-07). `host` is pre-validated by isValidCustomDomain (D-09), so it
// cannot contain a `"` to break the JSON string. Writes ONLY routes[] — never workers_dev (D-08).
export function wireCustomDomain(wj, host) {
  return wj
    .replace(/("vars":\s*\{[^\n}]*\})(\s*)$/m, '$1,$2')
    .replace(
      /\/\/\s*("routes":\s*\[\{\s*"pattern":\s*")REPLACE_WITH_YOUR_CUSTOM_DOMAIN("\s*,\s*"custom_domain":\s*true\s*\}\])/,
      `$1${host}$2`,
    )
}

// Rewrite every identifier sentinel across SUBSTITUTION_FILESET. Returns the list of changed
// (relative) paths. `dryRun` computes the rewrite without writing. NEVER JSON.parse the config
// files — wrangler.jsonc is JSONC (comments) and package.json round-tripping drifts formatting.
// `customDomain` (pre-validated host or null) gates the D-07 routes write on the wrangler.jsonc pass.
// WR-17-02: `collect` (optional) captures the post-substitution content of every CHANGED file
// (rel → after string). --dry-run passes it so the outstanding-placeholder preview can scan the
// in-memory result rather than the untouched disk — otherwise cms/wrangler.jsonc's auto-filled
// `_D1_NAME`/`_R2_BUCKET` placeholders (gone after a real run) were reported as "outstanding",
// misleading the user into hand-editing names setup.mjs actually derives.
export function substitute(rootDir, vals, { dryRun = false, customDomain = null, collect = null } = {}) {
  const {
    workerSlug,
    pkgName,
    appName,
    clerkPk,
    d1Name,
    cmsName,
    cmsD1Name,
    cmsR2Bucket,
    cmsCorsOrigin,
    cmsApiUrl,
  } = vals
  const changed = []

  const apply = (rel, transform) => {
    const fp = path.join(rootDir, rel)
    if (!existsSync(fp)) return
    const before = readFileSync(fp, 'utf8')
    const after = transform(before)
    if (after !== before) {
      changed.push(rel)
      if (collect) collect[rel] = after
      if (!dryRun) writeFileAtomic(fp, after)
    }
  }

  // wrangler.jsonc — field-targeted (the ONLY ambiguous file). Anchored regexes keep
  // `binding` (→ code id) and `database_name` (→ real resource name) DISTINCT, fill the
  // empty Clerk pub-key var, and rename ONLY the worker-`name` value (leaving the
  // explanatory comments on lines 8–12 intact, Open Question 3). REPLACE_WITH_YOUR_* IDs
  // are deliberately untouched.
  apply('wrangler.jsonc', (wj) => {
    let out = wj
      .replace(/("binding":\s*")__D1_BINDING__(")/, `$1${D1_BINDING}$2`)
      .replace(/("database_name":\s*")__D1_BINDING__(")/, `$1${d1Name}$2`)
      .replace(/("binding":\s*")__KV_BINDING__(")/, `$1${KV_BINDING}$2`)
      .replace(/("name":\s*")dashboard-cf-hono-template(")/, `$1${workerSlug}$2`)
      .replace(/("CLERK_PUBLISHABLE_KEY":\s*")(")/, `$1${clerkPk ?? ''}$2`)
    // D-07: uncomment + fill the dormant routes line ONLY when a host is set (byte-stable no-flag path).
    // IN-01: truthiness (not `!= null`) so a direct caller passing `customDomain: ''` is treated as
    // "no domain" — an empty host would otherwise emit a meaningless active `"pattern": ""` route.
    if (customDomain) out = wireCustomDomain(out, customDomain)
    return out
  })

  // cms/wrangler.jsonc — SEPARATE field-targeted branch (D-03 / T-17-01). CRITICAL divergence
  // from the main worker: parameterize ONLY name / database_name / bucket_name / (conditional)
  // CORS_ORIGINS. NEVER touch a `"binding"` line — SonicJS core reads DB / MEDIA_BUCKET /
  // CACHE_KV by literal name at runtime, so those identifiers (and the *_id resource-ID
  // placeholders) stay literal. The worker `name` is a literal-string match on the -cms-suffixed
  // placeholder (mirrors the main-worker literal-name carve-out); database_name / bucket_name
  // anchor on their REPLACE_WITH_YOUR_CMS_* placeholders. CORS_ORIGINS fills from "" ONLY when
  // an origin was supplied (truthiness gate, mirrors customDomain) — byte-stable otherwise (D-05).
  apply('cms/wrangler.jsonc', (cw) => {
    let out = cw
      .replace(/("name":\s*")dashboard-cf-hono-template-cms(")/, `$1${cmsName}$2`)
      .replace(/("database_name":\s*")REPLACE_WITH_YOUR_CMS_D1_NAME(")/, `$1${cmsD1Name}$2`)
      .replace(/("bucket_name":\s*")REPLACE_WITH_YOUR_CMS_R2_BUCKET(")/, `$1${cmsR2Bucket}$2`)
    if (cmsCorsOrigin) {
      out = out.replace(/("CORS_ORIGINS":\s*")(")/, `$1${cmsCorsOrigin}$2`)
    }
    // BETTER_AUTH_URL = the CMS Worker's OWN public origin (where /auth + /admin live).
    // Derived from --cms-api-url (a validated single https origin, so `.origin` is safe).
    // Without it, /admin login can't set the __Secure- session cookie (see cms/wrangler.jsonc).
    if (cmsApiUrl) {
      out = out.replace(/("BETTER_AUTH_URL":\s*")(")/, `$1${new URL(cmsApiUrl).origin}$2`)
    }
    return out
  })

  // Everywhere else the binding token maps uniformly to the code identifier → safe replaceAll.
  // __APP_NAME__ is the one free-form value, so it is context-escaped per target file (WR-04):
  // HTML-escaped for index.html, JS-single-quote-escaped for the TS string in sidebar-data.ts.
  for (const rel of SUBSTITUTION_FILESET) {
    // Both wrangler configs are field-targeted above — keep the blind __X__ replaceAll loop
    // off them so the anchored branches stay the ONLY writers (cms/wrangler.jsonc carries no
    // __X__ tokens, but the guard preserves the invariant that binding names are never touched).
    if (rel === 'wrangler.jsonc' || rel === 'cms/wrangler.jsonc') continue
    const appNameSafe = rel.endsWith('.html')
      ? htmlEscape(appName)
      : rel.endsWith('.ts') || rel.endsWith('.tsx')
        ? jsSingleQuoteEscape(appName)
        : appName
    apply(rel, (c) =>
      c
        .replaceAll('__PKG_NAME__', pkgName)
        .replaceAll('__APP_NAME__', appNameSafe)
        .replaceAll('__D1_BINDING__', D1_BINDING)
        .replaceAll('__KV_BINDING__', KV_BINDING),
    )
  }

  return changed
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocking leftover-sentinel scan.
// ─────────────────────────────────────────────────────────────────────────────

// Read each non-exempt file, strip the `//`-comment tail before testing, and split hits into
// hardFails (identifier sentinels → BLOCKING) and outstanding (REPLACE_WITH_YOUR_* → report).
// Pure: returns { hardFails, outstanding }; the CLI decides the exit code.
// WR-17-02: `overrides` (rel → content) lets a caller scan in-memory post-substitution content
// instead of the on-disk file — used by --dry-run so its preview matches what a real run produces
// (a real run writes first, then scans disk). Files absent from `overrides` are read from disk.
export function scanForSentinels(rootDir, fileSet = SUBSTITUTION_FILESET, overrides = {}) {
  const hardFails = []
  const outstanding = []
  for (const rel of fileSet) {
    if (EXEMPT_PATHS.some((p) => rel.startsWith(p))) continue
    let content
    if (Object.prototype.hasOwnProperty.call(overrides, rel)) {
      content = overrides[rel]
    } else {
      const fp = path.join(rootDir, rel)
      if (!existsSync(fp)) continue
      content = readFileSync(fp, 'utf8')
    }
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      // Strip only a REAL trailing `//` comment (one preceded by whitespace), NOT a `://`
      // inside a string literal (e.g. a URL). The old `line.split('//')[0]` truncated at the
      // first `//`, so an un-substituted sentinel sitting AFTER a `https://…` URL was silently
      // dropped and shipped — defeating the last-line-of-defense scan (WR-01).
      const code = line.replace(/\s\/\/.*$/, '') // ignore // comment tails, keep :// (D-10)
      if (HARD_FAIL_RE.test(code)) hardFails.push(`${rel}:${i + 1}: ${line.trim()}`)
      else if (REPLACE_RE.test(code)) outstanding.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
  return { hardFails, outstanding }
}

// ─────────────────────────────────────────────────────────────────────────────
// .dev.vars generation (SETUP-02). Fill the developer's local env file from the
// tracked .dev.vars.example, pre-filling the Clerk PUBLISHABLE key into BOTH
// publishable assignments (the VITE_-prefixed client key and the Worker-side key)
// and leaving CLERK_SECRET_KEY EMPTY — the secret is checklist-only, set via
// `wrangler secret put` and never persisted to any file (D-06, T-05-01). An
// existing .dev.vars is backed up to .dev.vars.bak first, never clobbered
// (D-07, Pitfall 6). Both .dev.vars and .dev.vars.bak are gitignored (.dev.vars.*);
// .dev.vars.example stays tracked (the ! negation).
// ─────────────────────────────────────────────────────────────────────────────

export function generateDevVars(rootDir, vals, { dryRun = false } = {}) {
  const pk = vals?.clerkPk ?? ''
  const examplePath = path.join(rootDir, '.dev.vars.example')
  const devVarsPath = path.join(rootDir, '.dev.vars')
  const backupPath = `${devVarsPath}.bak`
  if (!existsSync(examplePath)) return { written: false, backedUp: false, path: devVarsPath }

  // Fill ONLY the two publishable-key right-hand sides. The `^…=$`-anchored, line-mode
  // regexes match the empty assignments precisely: `^CLERK_PUBLISHABLE_KEY=` cannot match
  // the `VITE_CLERK_PUBLISHABLE_KEY=` line (different prefix), and CLERK_SECRET_KEY is
  // never targeted, so it stays empty.
  const filled = readFileSync(examplePath, 'utf8')
    .replace(/^(VITE_CLERK_PUBLISHABLE_KEY=).*$/m, `$1${pk}`)
    .replace(/^(CLERK_PUBLISHABLE_KEY=).*$/m, `$1${pk}`)

  const existed = existsSync(devVarsPath)
  if (dryRun) return { written: false, backedUp: existed, path: devVarsPath }

  // Back up an existing file BEFORE writing (never clobber a developer's real keys).
  if (existed) copyFileSync(devVarsPath, backupPath)
  writeFileAtomic(devVarsPath, filled)
  return { written: true, backedUp: existed, path: devVarsPath }
}

// ─────────────────────────────────────────────────────────────────────────────
// .env.local generation (AUTH-04 / SETUP-02, Item 1 — audit WARNING-2). Vite
// inlines `import.meta.env.VITE_*` ONLY from `.env*` files, NOT from `.dev.vars`
// (a Worker file), so the publishable key written to `.dev.vars` never reaches the
// SPA bundle — a fresh forker hits the MissingClerkPubKey screen. This writer emits
// a gitignored `.env.local` whose ENTIRE content is the single client publishable
// line so Vite inlines it and ClerkProvider renders. Unlike generateDevVars there is
// NO `.env.local.example` template — the content is a literal single line (Pitfall 6).
// ONLY the non-secret VITE_ publishable key goes here — never a CLERK_SECRET_KEY /
// sk_ value (D-02, T-08-01). The file is written even when the key is empty (emits the
// `VITE_CLERK_PUBLISHABLE_KEY=` hint line, D-03). An existing `.env.local` is backed up
// to `.env.local.bak` first, never clobbered (D-03, T-08-02). Both `.env.local` and
// `.env.local.bak` are gitignored via `.gitignore *.local`, so neither enters CI scans.
// ─────────────────────────────────────────────────────────────────────────────

export function generateEnvLocal(rootDir, vals, { dryRun = false } = {}) {
  const pk = vals?.clerkPk ?? ''
  const cmsApiUrl = vals?.cmsApiUrl ?? ''
  const envLocalPath = path.join(rootDir, '.env.local')
  const backupPath = `${envLocalPath}.bak`

  // Build the content directly — a single client publishable-key line (D-02). No
  // example-template read/regex-fill (there is no .env.local.example, Pitfall 6). When
  // --cms-api-url was supplied (SETUP-09 / D-05), append a second VITE_CMS_API_URL line so the
  // Vite build bakes the CMS origin (the single seam cms-client.ts reads); byte-stable
  // single-line output when it is absent. cmsApiUrl is https-validated up front (T-17-02), so
  // it cannot inject an extra env line.
  let content = `VITE_CLERK_PUBLISHABLE_KEY=${pk}\n`
  if (cmsApiUrl) content += `VITE_CMS_API_URL=${cmsApiUrl}\n`

  const existed = existsSync(envLocalPath)
  if (dryRun) return { written: false, backedUp: existed, path: envLocalPath }

  // Back up an existing file BEFORE writing (never clobber a developer's real key).
  if (existed) copyFileSync(envLocalPath, backupPath)
  writeFileAtomic(envLocalPath, content)
  return { written: true, backedUp: existed, path: envLocalPath }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-account creation checklist (SETUP-02). Prints copy-pasteable `wrangler`
// commands with the project's chosen D1 / KV names interpolated. The names are
// SANITIZED to a `[a-z0-9-]` token BEFORE interpolation (slugify) so a pasted
// command can never carry `;`, backticks, or `$(…)` (T-05-04, command-injection
// on paste). The Clerk SECRET is set here via `wrangler secret put` only — it is
// never written to a file. Surfaces the same REPLACE_WITH_YOUR_* resource-ID
// fill step the blocking scan reports as non-blocking, so checklist + self-check
// agree, then points at `pnpm cf-typegen` to regenerate the binding types (D-05).
// ─────────────────────────────────────────────────────────────────────────────

export function printChecklist(vals, { outstanding = [] } = {}) {
  const d1 = slugify(vals.d1Name)
  const kv = slugify(vals.kvTitle)
  // Slugify every CMS name before interpolation (same command-injection guard as the main
  // names) so a pasted `wrangler … create` line can never carry `;`, backticks, or `$(…)`.
  const cmsD1 = slugify(vals.cmsD1Name)
  const cmsR2 = slugify(vals.cmsR2Bucket)
  const cmsKv = slugify(vals.cmsKvTitle)
  const lines = [
    '',
    '── Dashboard Worker — Cloudflare resource checklist ─────────────────────────',
    'Create the per-account resources, then paste the returned IDs into wrangler.jsonc:',
    '',
    `  1. wrangler d1 create ${d1}`,
    '       then paste the returned "database_id" over REPLACE_WITH_YOUR_D1_ID in wrangler.jsonc',
    `  2. wrangler kv namespace create ${kv}`,
    '       then paste the returned "id" over REPLACE_WITH_YOUR_KV_ID in wrangler.jsonc',
    '  3. wrangler secret put CLERK_SECRET_KEY',
    '       sets the Clerk SECRET in production (never committed; .dev.vars leaves it empty)',
    '',
    'Then regenerate the binding types authoritatively from the filled bindings:',
    '  4. pnpm cf-typegen',
    '',
    '── CMS Worker (cms/) — resource checklist ───────────────────────────────────',
    "Create the CMS Worker's OWN D1 / R2 / KV, then paste the returned IDs into",
    'cms/wrangler.jsonc (its binding NAMES DB / MEDIA_BUCKET / CACHE_KV stay literal):',
    '',
    `  1. wrangler d1 create ${cmsD1}`,
    '       paste the returned "database_id" over REPLACE_WITH_YOUR_CMS_D1_ID in cms/wrangler.jsonc',
    `  2. wrangler r2 bucket create ${cmsR2}`,
    '       the CMS needs an R2 media bucket (the dashboard Worker has none)',
    `  3. wrangler kv namespace create ${cmsKv}`,
    '       paste the returned "id" over REPLACE_WITH_YOUR_CMS_KV_ID in cms/wrangler.jsonc',
    '  4. (cd cms && wrangler d1 migrations apply DB --remote)',
    '       applies the @sonicjs-cms/core-owned migrations to the CMS D1',
    '  5. wrangler secret put BETTER_AUTH_SECRET   (then: wrangler secret put JWT_SECRET)',
    '       the two runtime CMS auth secrets — generate each with `openssl rand -hex 32`',
    '  6. ADMIN_EMAIL / ADMIN_PASSWORD are SEED-TIME shell env for `pnpm seed`',
    '       (NOT `wrangler secret put` runtime secrets — see cms/.dev.vars.example)',
    '  ⚠ Rotate the seeded admin credentials before the FIRST CMS deploy — never ship the',
    '       default seed credentials to a public origin.',
    '',
    'After BOTH Workers deploy (their *.workers.dev origins only exist post-deploy):',
    '  7. set cms/wrangler.jsonc CORS_ORIGINS to the EXACT dashboard origin (no wildcard)',
    '  8. set VITE_CMS_API_URL (in .env.local) to the CMS origin, then rebuild + redeploy the',
    '       dashboard so the Vite build bakes the new value',
    '',
  ]
  if (outstanding.length) {
    lines.push('Outstanding REPLACE_WITH_YOUR_* placeholders to fill after the steps above:')
    for (const o of outstanding) lines.push(`  - ${o}`)
    lines.push('')
  }
  console.log(lines.join('\n'))
  // Loud, hard-to-miss admin-rotation banner (Phase 14 D-08), carried on stderr so it stands
  // out from the copy-paste checklist above. Concept only — no seeded default credential string.
  printLoudBlock('ROTATE CMS ADMIN CREDENTIALS BEFORE FIRST DEPLOY', [
    'The CMS seeds a bootstrap admin account. Rotate ADMIN_EMAIL / ADMIN_PASSWORD to strong,',
    'unique values and re-seed BEFORE the CMS Worker is first deployed to a public origin.',
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-toggle record (SETUP-03 / D-12). writeModuleConfig() persists the developer's
// module intent to `.setup-config.json` using the LOCKED Open-Question-2 schema
// `{ asyncLayer, integrationApi, schemaVersion }` (stable 2-space JSON + trailing newline,
// via the write-then-rename helper). Only booleans + a schema version are written — NO secrets
// and NO wrangler async config is touched (T-05-09): the async layer config does not exist yet,
// so the toggle RECORDS the choice only; Phase 7 reads `asyncLayer` to uncomment the then-present
// config. `integrationApi` is ALWAYS forced false (v2 no-op) regardless of the requested value.
// `.setup-config.json` is already gitignored + in EXEMPT_PATHS (05-01) — not re-added here.
// ─────────────────────────────────────────────────────────────────────────────

export function writeModuleConfig(rootDir, choices = {}, { dryRun = false } = {}) {
  const config = {
    asyncLayer: Boolean(choices.asyncLayer),
    integrationApi: false, // v2 no-op — forced false regardless of input (D-12 / T-05-09)
    schemaVersion: MODULE_CONFIG_SCHEMA_VERSION,
  }
  const json = `${JSON.stringify(config, null, 2)}\n`
  if (!dryRun) writeFileAtomic(path.join(rootDir, MODULE_CONFIG), json)
  return config
}

// Explain what the recorded choices do (and do NOT do): when async layer is enabled, point at
// docs/async-layer.md with a brief activation checklist (this function PRINTS only — it does NOT
// uncomment index.ts or wrangler.jsonc; D-05). integration-API is reserved for v2 (forced false).
function printModuleNote(config) {
  const lines = [
    '',
    '── Module toggles (recorded to .setup-config.json) ─────────────────────────',
    `  async layer   : ${config.asyncLayer ? 'enabled (choice recorded)' : 'disabled'}`,
  ]
  if (config.asyncLayer) {
    lines.push(
      '      → the Cron → Queues → Resend layer ships DORMANT. To activate it, follow',
      '        docs/async-layer.md:',
      '          1. wrangler queues create <your-queue>   (+ <your-queue>-dlq dead-letter queue)',
      '          2. uncomment the src/server/index.ts arming seam + the wrangler.jsonc',
      '             cron/queue blocks, then run `wrangler types`',
      '          3. wrangler secret put RESEND_API_KEY',
      '          4. pnpm deploy',
      '        Nothing is uncommented for you — this is a pointer, not a file edit.',
    )
  }
  lines.push(
    `  integration-API: ${config.integrationApi} (v2 — not yet available; always recorded false)`,
    '',
  )
  console.log(lines.join('\n'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared loud-banner helper (D-02). Generalises the line-array + rule idiom of
// printChecklist()/printModuleNote() into a title-flanked block that is visually
// distinct from ordinary log lines. Emits via console.warn (stderr): a fixed-width
// rule above the title, another below it, each body line indented two spaces, a
// closing rule, and a trailing blank line. Kept generic (title + body lines only)
// so plan 10-03 can reuse it for the custom-domain slug echo banner.
// ─────────────────────────────────────────────────────────────────────────────
export function printLoudBlock(title, bodyLines) {
  const rule = '━'.repeat(76)
  console.warn(['', rule, `  ${title}`, rule, ...bodyLines.map((l) => `  ${l}`), rule, ''].join('\n'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme swap (SETUP-04). loadPreset() resolves the chosen tweakcn preset —
// keep-default (no arg), a local JSON path, or an https tweakcn.com registry item —
// and ALWAYS degrades to the shipped default rather than throwing (D-08 graceful
// offline). regenerateTheme() rebuilds theme.css byte-faithfully per the
// docs/THEMING.md Phase-5 contract: values are written VERBATIM (never oklch-parsed,
// Pitfall 4) but rejected if they could break out of a CSS declaration (T-05-02);
// the --color-* utility map and the --radius-* scale are generated from the light
// token-key SET, never read from cssVars (D-09 — sourcing them from cssVars.theme
// would drop every Tailwind color utility).
// ─────────────────────────────────────────────────────────────────────────────

// cssVars.{light,dark} must both be present — exporting only one half leaves a mode on
// the previous palette (docs/THEMING.md "Light / dark mode"). Used as the import-shape gate.
function assertPresetShape(preset) {
  const cv = preset?.cssVars
  const isObj = (o) => o != null && typeof o === 'object'
  if (!isObj(cv) || !isObj(cv.light) || !isObj(cv.dark)) {
    throw new Error('preset missing cssVars.light / cssVars.dark objects')
  }
  // WR-02: regenerateTheme() emits `--radius: ${theme.radius};` unconditionally (from
  // cssVars.theme), so a preset that has light+dark but omits cssVars.theme (or theme.radius)
  // would write a literal `--radius: undefined;` — and theme.radius, absent, is never seen by
  // the key/value injection guard. Require cssVars.theme with a string radius at the gate so
  // such a preset fails the shape check and falls back to the shipped default instead of
  // producing structurally-broken CSS.
  if (!isObj(cv.theme) || typeof cv.theme.radius !== 'string') {
    throw new Error('preset missing cssVars.theme.radius string')
  }
}

// normalizeThemeUrl() (D-04) is a pure URL→URL transform applied to a `--theme` URL AFTER
// `new URL()` but BEFORE the host/scheme allow-list (D-06 ordering). It ONLY ever mutates the
// pathname (host preserved), so the unchanged host guard still rejects non-tweakcn inputs
// (Pitfall 2 — a rewrite that touched the host would be an SSRF hole).
//
// Every tweakcn form normalizes to the EXTENSIONLESS registry item `/r/themes/<id>`, dropping
// search/hash and any trailing slash (a trailing-slash registry URL 308s under
// redirect:'manual' → silent fallback, Pitfall 3).
//
// The `.json` suffix this used to append is what BROKE the whole remote-theme path: tweakcn
// serves user-saved themes (cuid ids) ONLY extensionless — `/r/themes/<cuid>.json` returns
// HTTP 500 while `/r/themes/<cuid>` returns the JSON. Built-in slugs still answer to both, so
// the bug hid behind `--theme https://tweakcn.com/themes/modern-minimal` and surfaced only on
// a real user theme. Extensionless is the one form that works for BOTH — never re-add `.json`.
//
// Non-tweakcn hosts are returned untouched for the downstream allow-list to reject.
export function normalizeThemeUrl(u) {
  if (u.hostname !== TWEAKCN_HOST) return u

  // Accept the page URL (`/themes/<id>`) or either registry form (`/r/themes/<id>[.json]`),
  // each with an optional trailing slash, and emit the canonical extensionless registry path.
  const m = u.pathname.match(/^(?:\/r)?\/themes\/(.+?)(?:\.json)?\/?$/)
  if (!m) return u
  return new URL(`https://${TWEAKCN_HOST}/r/themes/${m[1]}`)
}

// resolvePreset() is the outcome-signalling resolver (D-01). It runs the SAME resolution
// body loadPreset() used to, but instead of near-silently `console.warn`-ing at each failure
// site and returning the shipped default, it returns a classified result:
//   { preset, outcome: 'keep-default' }        — no --theme arg (silent, no fetch)
//   { preset, outcome: 'applied' }             — a local path or remote import succeeded
//   { preset, outcome: 'fallback', reason }    — a --theme source was given but could not be
//                                                 applied; preset is the shipped default and
//                                                 `reason` is the message the old warn emitted
// main() branches on 'fallback' to print a loud block (D-02) and, under --require-theme, exit
// non-zero (D-03). EVERY existing guard is preserved verbatim (path-root confinement T-05-05,
// https+host allow-list T-05-03, redirect:'manual' + resolved-host re-check WR-05, 8s timeout,
// assertPresetShape) — this is a mechanical "warn → return reason" transform, nothing reordered.
export async function resolvePreset(themeArg, rootDir = process.cwd()) {
  const shippedPath = path.join(rootDir, SHIPPED_PRESET_REL)
  const readShipped = () => JSON.parse(readFileSync(shippedPath, 'utf8'))

  // No arg → keep-default (no-op against the shipped stylesheet).
  if (!themeArg) return { preset: readShipped(), outcome: 'keep-default' }

  const isUrl = /^https?:\/\//i.test(themeArg)

  // A non-URL arg is a local path: resolve it and confine reads to the project root,
  // rejecting any `..` that escapes it (T-05-05). A missing path is treated as a bare
  // tweakcn theme-id below.
  if (!isUrl) {
    const rootResolved = path.resolve(rootDir)
    const resolved = path.resolve(rootDir, themeArg)
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      return {
        preset: readShipped(),
        outcome: 'fallback',
        reason: '--theme path escapes the project root',
      }
    }
    if (existsSync(resolved)) {
      try {
        const preset = JSON.parse(readFileSync(resolved, 'utf8'))
        assertPresetShape(preset)
        return { preset, outcome: 'applied' }
      } catch (err) {
        return {
          preset: readShipped(),
          outcome: 'fallback',
          reason: `local preset load failed (${err.message})`,
        }
      }
    }
  }

  // Remote import: an explicit https URL or a bare theme-id → the tweakcn registry URL.
  // For URL inputs, normalizeThemeUrl rewrites a tweakcn page path to the registry .json path
  // (D-04) — it runs BEFORE the host/scheme allow-list below (D-06) and only mutates the
  // pathname, so a non-tweakcn host is never rewritten and is still rejected by that guard
  // (SSRF preserved, Pitfall 2). Restrict scheme=https + host=tweakcn.com (SSRF, T-05-03);
  // any failure → fall back.
  let url
  try {
    url = isUrl
      ? normalizeThemeUrl(new URL(themeArg))
      : new URL(`https://${TWEAKCN_HOST}/r/themes/${encodeURIComponent(themeArg)}`)
  } catch {
    return { preset: readShipped(), outcome: 'fallback', reason: 'invalid --theme value' }
  }
  if (url.protocol !== 'https:' || url.hostname !== TWEAKCN_HOST) {
    return {
      preset: readShipped(),
      outcome: 'fallback',
      reason: `--theme host not allowed (only https://${TWEAKCN_HOST})`,
    }
  }
  try {
    // WR-05: the host/scheme allow-list above only validated the INITIAL url. With the default
    // `redirect: 'follow'`, a 3xx from tweakcn.com (open redirect / compromise) would be
    // transparently followed to an arbitrary host — including internal/metadata addresses —
    // bypassing the allow-list. `redirect: 'manual'` stops the auto-follow; any 3xx then has
    // res.ok === false and is treated as a failure (fall back to the shipped preset). As
    // defense-in-depth, re-validate the resolved response host against the allow-list too.
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'manual' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (res.url) {
      const resolved = new URL(res.url)
      if (resolved.protocol !== 'https:' || resolved.hostname !== TWEAKCN_HOST) {
        throw new Error(`response host not allowed: ${resolved.hostname}`)
      }
    }
    const preset = await res.json()
    assertPresetShape(preset)
    return { preset, outcome: 'applied' }
  } catch (err) {
    return {
      preset: readShipped(),
      outcome: 'fallback',
      reason: `tweakcn import failed (${err.message})`,
    }
  }
}

// Back-compat shim: loadPreset() keeps its original (preset-only) return shape by delegating to
// resolvePreset() and unwrapping `.preset`. The 6 existing theme-regen loadPreset tests assert on
// this shape and stay green unchanged.
export async function loadPreset(themeArg, rootDir = process.cwd()) {
  return (await resolvePreset(themeArg, rootDir)).preset
}

// Assemble theme.css from a preset, byte-faithfully. 2-space indent, trailing newline.
export function regenerateTheme(preset) {
  const theme = preset?.cssVars?.theme ?? {}
  const light = preset?.cssVars?.light ?? {}
  const dark = preset?.cssVars?.dark ?? {}

  // Validate EVERY emitted value before producing any output (T-05-02). oklch literals,
  // the `oklch(1 0 0 / 10%)` alpha form, `var(--*)` indirections, and `'Font', 'sans-serif'`
  // font stacks all pass; a value carrying `{`, `}`, `;`, or a newline is rejected.
  const guard = (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      // KEY side (CR-01): keys are interpolated straight into `--${k}` / `--color-${k}`
      // declarations, so an unconstrained key injects arbitrary CSS structure. Validate the
      // key with the same rigor as the value BEFORE emitting either.
      if (typeof k !== 'string' || !SAFE_CSS_KEY_RE.test(k)) {
        throw new Error(`Unsafe preset key: ${JSON.stringify(k)}`)
      }
      if (typeof v !== 'string' || FORBIDDEN_CSS_VALUE_RE.test(v)) {
        throw new Error(`Unsafe preset value for "${k}": ${JSON.stringify(v)}`)
      }
    }
  }
  guard(theme)
  guard(light)
  guard(dark)

  const lines = []

  // :root — base --radius from cssVars.theme, then the light tokens in order; ONE blank
  // line before the first sidebar-prefixed key (only if one exists), then the sidebar block.
  lines.push(':root {')
  lines.push(`  --radius: ${theme.radius};`)
  let blankBeforeSidebar = false
  for (const [k, v] of Object.entries(light)) {
    if (!blankBeforeSidebar && k.startsWith('sidebar')) {
      lines.push('')
      blankBeforeSidebar = true
    }
    lines.push(`  --${k}: ${v};`)
  }
  lines.push('}')

  // .dark — the dark tokens only (NO radius, NO sidebar; do not assume light/dark symmetry).
  lines.push('')
  lines.push('.dark {')
  for (const [k, v] of Object.entries(dark)) lines.push(`  --${k}: ${v};`)
  lines.push('}')

  // @theme inline — the cssVars.theme font-* entries, ONE blank line, the four fixed radius
  // scale lines VERBATIM, then a --color-<key> for EVERY light key (color THEN sidebar, with
  // NO blank line between — unlike :root). The color map + radius scale come from the key SET.
  lines.push('')
  lines.push('@theme inline {')
  for (const [k, v] of Object.entries(theme)) {
    if (k.startsWith('font-')) lines.push(`  --${k}: ${v};`)
  }
  lines.push('')
  lines.push('  --radius-sm: calc(var(--radius) - 4px);')
  lines.push('  --radius-md: calc(var(--radius) - 2px);')
  lines.push('  --radius-lg: var(--radius);')
  lines.push('  --radius-xl: calc(var(--radius) + 4px);')
  for (const k of Object.keys(light)) lines.push(`  --color-${k}: var(--${k});`)
  lines.push('}')

  return lines.join('\n') + '\n'
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry.
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: false,
    options: {
      yes: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      name: { type: 'string' },
      'app-name': { type: 'string' },
      'clerk-pk': { type: 'string' },
      'd1-name': { type: 'string' },
      'kv-title': { type: 'string' },
      'cms-name': { type: 'string' },
      'cms-d1-name': { type: 'string' },
      'cms-r2-bucket': { type: 'string' },
      'cms-kv-title': { type: 'string' },
      'cms-cors-origin': { type: 'string' },
      'cms-api-url': { type: 'string' },
      theme: { type: 'string' },
      'require-theme': { type: 'boolean', default: false },
      'custom-domain': { type: 'string' },
    },
  })

  const rootDir = process.cwd()

  // Idempotency guard FIRST — before any file write (D-11).
  if (existsSync(path.join(rootDir, MARKER)) && !values.force) {
    console.error(`Setup already completed (${MARKER} present). Re-run with --force to override.`)
    process.exit(1)
  }

  // isTTY guard: only build a readline interface when truly interactive.
  const interactive = !values.yes && Boolean(process.stdin.isTTY)
  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null

  let vals
  let moduleChoices
  try {
    vals = await resolveInputs(values, process.env, { interactive, rl })
    // Module toggles share the same TTY-guarded readline; resolve them BEFORE rl closes.
    moduleChoices = await resolveModuleChoices({ interactive, rl })
  } finally {
    rl?.close()
  }

  // D-09: validate --custom-domain BEFORE any file write, so an invalid host exits 1 with no
  // partial write (mirrors how resolveInputs validates every field via ensureValid).
  if (values['custom-domain'] != null) {
    ensureValid(values['custom-domain'], isValidCustomDomain, 'custom-domain')
  }

  // SETUP-09 / T-17-02: validate the two optional CMS cross-worker URLs BEFORE any file write
  // (same atomic-failure invariant as --custom-domain) so an invalid origin exits 1 with no
  // partial write to cms/wrangler.jsonc or .env.local.
  if (values['cms-cors-origin'] != null) {
    ensureValid(values['cms-cors-origin'], isValidCmsOrigins, 'cms-cors-origin')
  }
  if (values['cms-api-url'] != null) {
    ensureValid(values['cms-api-url'], isValidCmsApiUrl, 'cms-api-url')
  }

  // D-11/D-12: echo every slug rewrite prominently NEAR THE TOP of the run (not folded into the
  // end-of-run checklist). rawByLabel is built from USER-SUPPLIED inputs only (A4 lock): the
  // worker slug's raw source is --name/SETUP_NAME, else --app-name/SETUP_APP_NAME, else none;
  // default-sourced fields are null and never echo. A clean run prints nothing.
  // WR-17-03: the four CMS-derived names go through the SAME slugify + SLUG_RE pipeline as the
  // main worker/d1/kv fields, so a raw `--cms-d1-name="My CMS DB"` is silently rewritten too.
  // Include them here so the loud SLUG REWRITES banner surfaces every auto-correction, not just
  // the main worker's (default-sourced fields stay null and never echo).
  const rawByLabel = {
    'worker slug':
      values.name ?? process.env.SETUP_NAME ?? values['app-name'] ?? process.env.SETUP_APP_NAME ?? null,
    'd1 name': values['d1-name'] ?? process.env.SETUP_D1_NAME ?? null,
    'kv title': values['kv-title'] ?? process.env.SETUP_KV_TITLE ?? null,
    'cms name': values['cms-name'] ?? process.env.SETUP_CMS_NAME ?? null,
    'cms d1 name': values['cms-d1-name'] ?? process.env.SETUP_CMS_D1_NAME ?? null,
    'cms r2 bucket': values['cms-r2-bucket'] ?? process.env.SETUP_CMS_R2_BUCKET ?? null,
    'cms kv title': values['cms-kv-title'] ?? process.env.SETUP_CMS_KV_TITLE ?? null,
  }
  const slugRewrites = computeSlugRewrites(rawByLabel)
  if (slugRewrites.length) {
    printLoudBlock(
      'SLUG REWRITES',
      slugRewrites.map((r) => `${r.from} → ${r.to}`),
    )
  }

  // Theme swap (SETUP-04): resolve the chosen preset (keep-default / local path / https
  // tweakcn URL, with offline fallback + SSRF + traversal guards) and enforce the
  // --require-theme gate BEFORE any filesystem write, mirroring the custom-domain
  // validate-before-write pattern (D-09). This keeps a failed run ATOMIC (CR-01): on a
  // --require-theme fallback the process exits non-zero here, so substitute() /
  // generateDevVars() / generateEnvLocal() never run, the tracked config, .dev.vars and
  // .env.local are never mutated, and — critically — the single-slot .bak backups are never
  // clobbered by a second no-marker re-run.
  //
  // A 'fallback' outcome means a --theme source was given but could not be applied — print a
  // prominent block (D-02) and, under --require-theme, exit non-zero (D-03). A 'keep-default'
  // outcome (no --theme) never prints and never exits. regenerateTheme() also runs here so a
  // structurally-broken preset fails closed with no partial write.
  const { preset, outcome, reason } = await resolvePreset(vals.theme, rootDir)
  if (outcome === 'fallback') {
    printLoudBlock('THEME NOT APPLIED', [
      `--theme could not be loaded: ${reason}`,
      'Shipped the neutral default theme instead.',
    ])
    if (values['require-theme']) process.exit(1) // exits before ANY write
  }
  const themeCss = regenerateTheme(preset)
  const presetJson = `${JSON.stringify(preset, null, 2)}\n`

  // WR-17-02: capture post-substitution content so the --dry-run outstanding-placeholder
  // preview scans the in-memory result (parity with a real run) instead of the untouched disk.
  const substituted = {}
  const changed = substitute(rootDir, vals, {
    dryRun: values['dry-run'],
    customDomain: values['custom-domain'] ?? null,
    collect: substituted,
  })

  // Generate the developer's local .dev.vars (backup-on-exists; secret stays empty) BEFORE
  // the final scan so a --dry-run reports it too.
  const devVars = generateDevVars(rootDir, vals, { dryRun: values['dry-run'] })

  // Generate the gitignored .env.local so Vite inlines the publishable key into the SPA
  // bundle (AUTH-04, audit WARNING-2). Same backup-on-exists + dry-run contract as above.
  const envLocal = generateEnvLocal(rootDir, vals, { dryRun: values['dry-run'] })

  if (values['dry-run']) {
    console.log(
      `[dry-run] would substitute sentinels in:\n${changed.map((c) => `  ${c}`).join('\n')}`,
    )
    console.log(
      `[dry-run] would write ${path.basename(devVars.path)}` +
        (devVars.backedUp ? ' (backing up existing → .dev.vars.bak)' : ''),
    )
    console.log(
      `[dry-run] would write ${path.basename(envLocal.path)}` +
        (envLocal.backedUp ? ' (backing up existing → .env.local.bak)' : ''),
    )
    console.log(
      `[dry-run] would regenerate ${THEME_CSS_REL}` +
        (outcome === 'applied'
          ? ` and rewrite ${SHIPPED_PRESET_REL} from --theme`
          : ' (keep-default no-op)'),
    )
    const wouldConfig = writeModuleConfig(rootDir, moduleChoices, { dryRun: true })
    console.log(`[dry-run] would write ${MODULE_CONFIG}: ${JSON.stringify(wouldConfig)}`)
    printModuleNote(wouldConfig)
    // IN-02: run the read-only sentinel scan so --dry-run previews the outstanding
    // REPLACE_WITH_YOUR_* resource-ID placeholders a real run surfaces (parity with the
    // write path's printChecklist(vals, { outstanding })). No files are written in dry-run,
    // so this only reads current on-disk state — the whole point a dry-run is meant to preview.
    const { outstanding } = scanForSentinels(rootDir, SUBSTITUTION_FILESET, substituted)
    printChecklist(vals, { outstanding })
    return
  }

  // Write the regenerated stylesheet (identical bytes on the keep-default path). Persist the
  // chosen preset as the new committed source ONLY when a --theme was actually APPLIED (WR-01):
  // gating on the outcome (not the coarse themeProvided) means a --theme that fell back never
  // rewrites/reformats the committed tweakcn-preset.json.
  if (outcome === 'applied') writeFileAtomic(path.join(rootDir, SHIPPED_PRESET_REL), presetJson)
  writeFileAtomic(path.join(rootDir, THEME_CSS_REL), themeCss)

  // Record the module-toggle choices (SETUP-03 / D-12). Records intent only — touches NO
  // wrangler async config this phase (the async layer ships in Phase 7). `.setup-config.json`
  // is in EXEMPT_PATHS, so the blocking scan below ignores it.
  const moduleConfig = writeModuleConfig(rootDir, moduleChoices)

  // BLOCKING scan: hard-fail on any identifier sentinel; report REPLACE_WITH_YOUR_* as
  // non-blocking outstanding actions.
  const { hardFails, outstanding } = scanForSentinels(rootDir)
  if (hardFails.length) {
    console.error(
      `Leftover identifier sentinels found — setup INCOMPLETE:\n${hardFails.join('\n')}`,
    )
    process.exit(1)
  }
  if (outstanding.length) {
    console.warn(
      `Outstanding (non-blocking) — fill these resource IDs after creating D1/KV:\n${outstanding.join(
        '\n',
      )}`,
    )
  }

  writeFileAtomic(path.join(rootDir, MARKER), `setup completed ${new Date().toISOString()}\n`)
  console.log(`Setup complete. Renamed ${changed.length} file(s); wrote ${MARKER}.`)

  // Module-toggle record + the Phase-7 deferral note (async effect lands in Phase 7; v2 stub).
  printModuleNote(moduleConfig)

  // Per-account creation checklist (sanitized, interpolated) — printed AFTER the marker write.
  printChecklist(vals, { outstanding })
}

// Only run main() when executed directly (`node setup.mjs`), NOT when imported by tests.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((err) => {
    console.error(err?.stack || String(err))
    process.exit(1)
  })
}
