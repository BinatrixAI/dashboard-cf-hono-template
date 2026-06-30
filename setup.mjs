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

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for direct unit testing).
// ─────────────────────────────────────────────────────────────────────────────

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

  return { workerSlug, pkgName: workerSlug, appName, clerkPk, d1Name, kvTitle, theme: values.theme }
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

// Rewrite every identifier sentinel across SUBSTITUTION_FILESET. Returns the list of changed
// (relative) paths. `dryRun` computes the rewrite without writing. NEVER JSON.parse the config
// files — wrangler.jsonc is JSONC (comments) and package.json round-tripping drifts formatting.
export function substitute(rootDir, vals, { dryRun = false } = {}) {
  const { workerSlug, pkgName, appName, clerkPk, d1Name } = vals
  const changed = []

  const apply = (rel, transform) => {
    const fp = path.join(rootDir, rel)
    if (!existsSync(fp)) return
    const before = readFileSync(fp, 'utf8')
    const after = transform(before)
    if (after !== before) {
      changed.push(rel)
      if (!dryRun) writeFileAtomic(fp, after)
    }
  }

  // wrangler.jsonc — field-targeted (the ONLY ambiguous file). Anchored regexes keep
  // `binding` (→ code id) and `database_name` (→ real resource name) DISTINCT, fill the
  // empty Clerk pub-key var, and rename ONLY the worker-`name` value (leaving the
  // explanatory comments on lines 8–12 intact, Open Question 3). REPLACE_WITH_YOUR_* IDs
  // are deliberately untouched.
  apply('wrangler.jsonc', (wj) =>
    wj
      .replace(/("binding":\s*")__D1_BINDING__(")/, `$1${D1_BINDING}$2`)
      .replace(/("database_name":\s*")__D1_BINDING__(")/, `$1${d1Name}$2`)
      .replace(/("binding":\s*")__KV_BINDING__(")/, `$1${KV_BINDING}$2`)
      .replace(/("name":\s*")dashboard-cf-hono-template(")/, `$1${workerSlug}$2`)
      .replace(/("CLERK_PUBLISHABLE_KEY":\s*")(")/, `$1${clerkPk ?? ''}$2`),
  )

  // Everywhere else the binding token maps uniformly to the code identifier → safe replaceAll.
  // __APP_NAME__ is the one free-form value, so it is context-escaped per target file (WR-04):
  // HTML-escaped for index.html, JS-single-quote-escaped for the TS string in sidebar-data.ts.
  for (const rel of SUBSTITUTION_FILESET) {
    if (rel === 'wrangler.jsonc') continue
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
export function scanForSentinels(rootDir, fileSet = SUBSTITUTION_FILESET) {
  const hardFails = []
  const outstanding = []
  for (const rel of fileSet) {
    if (EXEMPT_PATHS.some((p) => rel.startsWith(p))) continue
    const fp = path.join(rootDir, rel)
    if (!existsSync(fp)) continue
    const lines = readFileSync(fp, 'utf8').split('\n')
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
  const envLocalPath = path.join(rootDir, '.env.local')
  const backupPath = `${envLocalPath}.bak`

  // Build the content directly — a single client publishable-key line (D-02). No
  // example-template read/regex-fill (there is no .env.local.example, Pitfall 6).
  const content = `VITE_CLERK_PUBLISHABLE_KEY=${pk}\n`

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
  const lines = [
    '',
    '── Cloudflare resource checklist ───────────────────────────────────────────',
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
  ]
  if (outstanding.length) {
    lines.push('Outstanding REPLACE_WITH_YOUR_* placeholders to fill after the steps above:')
    for (const o of outstanding) lines.push(`  - ${o}`)
    lines.push('')
  }
  console.log(lines.join('\n'))
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
}

export async function loadPreset(themeArg, rootDir = process.cwd()) {
  const shippedPath = path.join(rootDir, SHIPPED_PRESET_REL)
  const readShipped = () => JSON.parse(readFileSync(shippedPath, 'utf8'))

  // No arg → keep-default (no-op against the shipped stylesheet).
  if (!themeArg) return readShipped()

  const isUrl = /^https?:\/\//i.test(themeArg)

  // A non-URL arg is a local path: resolve it and confine reads to the project root,
  // rejecting any `..` that escapes it (T-05-05). A missing path is treated as a bare
  // tweakcn theme-id below.
  if (!isUrl) {
    const rootResolved = path.resolve(rootDir)
    const resolved = path.resolve(rootDir, themeArg)
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      console.warn(`--theme path escapes the project root; keeping shipped default theme.`)
      return readShipped()
    }
    if (existsSync(resolved)) {
      try {
        const preset = JSON.parse(readFileSync(resolved, 'utf8'))
        assertPresetShape(preset)
        return preset
      } catch (err) {
        console.warn(`local preset load failed (${err.message}); keeping shipped default theme.`)
        return readShipped()
      }
    }
  }

  // Remote import: an explicit https URL or a bare theme-id → the tweakcn registry URL.
  // Restrict scheme=https + host=tweakcn.com (SSRF, T-05-03); any failure → fall back.
  let url
  try {
    url = isUrl
      ? new URL(themeArg)
      : new URL(`https://${TWEAKCN_HOST}/r/themes/${encodeURIComponent(themeArg)}.json`)
  } catch {
    console.warn(`invalid --theme value; keeping shipped default theme.`)
    return readShipped()
  }
  if (url.protocol !== 'https:' || url.hostname !== TWEAKCN_HOST) {
    console.warn(
      `--theme host not allowed (only https://${TWEAKCN_HOST}); keeping shipped default theme.`,
    )
    return readShipped()
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
    return preset
  } catch (err) {
    console.warn(`tweakcn import failed (${err.message}); keeping shipped default theme.`)
    return readShipped()
  }
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
      theme: { type: 'string' },
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

  const changed = substitute(rootDir, vals, { dryRun: values['dry-run'] })

  // Generate the developer's local .dev.vars (backup-on-exists; secret stays empty) BEFORE
  // the final scan so a --dry-run reports it too.
  const devVars = generateDevVars(rootDir, vals, { dryRun: values['dry-run'] })

  // Generate the gitignored .env.local so Vite inlines the publishable key into the SPA
  // bundle (AUTH-04, audit WARNING-2). Same backup-on-exists + dry-run contract as above.
  const envLocal = generateEnvLocal(rootDir, vals, { dryRun: values['dry-run'] })

  // Theme swap (SETUP-04): resolve the chosen preset (keep-default / local path / https
  // tweakcn URL, with offline fallback + SSRF + traversal guards), regenerate theme.css
  // byte-faithfully, and — only when a non-default source was actually provided — persist the
  // chosen preset to tweakcn-preset.json. The default path is a provable no-op (regenerating
  // the shipped preset reproduces the committed stylesheet exactly).
  const themeProvided = Boolean(vals.theme)
  const preset = await loadPreset(vals.theme, rootDir)
  const themeCss = regenerateTheme(preset)
  const presetJson = `${JSON.stringify(preset, null, 2)}\n`

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
        (themeProvided ? ` and rewrite ${SHIPPED_PRESET_REL} from --theme` : ' (keep-default no-op)'),
    )
    const wouldConfig = writeModuleConfig(rootDir, moduleChoices, { dryRun: true })
    console.log(`[dry-run] would write ${MODULE_CONFIG}: ${JSON.stringify(wouldConfig)}`)
    printModuleNote(wouldConfig)
    printChecklist(vals)
    return
  }

  // Write the regenerated stylesheet (identical bytes on the keep-default path). When a
  // non-default --theme was provided, also persist the chosen preset as the new committed source.
  if (themeProvided) writeFileAtomic(path.join(rootDir, SHIPPED_PRESET_REL), presetJson)
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
