# Secrets & Environment Variables

This template has four distinct places a value can live. Picking the wrong one
either leaks a secret into the client bundle or leaves production unconfigured.

| Mechanism                       | Where it lives                     | Scope                  | Secret-safe?                     |
| ------------------------------- | ---------------------------------- | ---------------------- | -------------------------------- |
| `.dev.vars`                     | local file (gitignored)            | Worker, local dev only | Yes — never committed            |
| `wrangler secret put <NAME>`    | Cloudflare (encrypted)             | Worker, production     | **Yes — this is the prod path**  |
| `vars` in `wrangler.jsonc`      | committed config                   | Worker                 | **No — plaintext in git**        |
| `VITE_*` (in `.env*`)           | inlined into the browser bundle    | Client SPA             | **No — shipped to every user**   |

Rules of thumb:

- A **real secret** (API key, `CLERK_SECRET_KEY`) → `wrangler secret put` in
  prod, `.dev.vars` locally. Nowhere else.
- **Non-secret Worker config** (a public URL, a feature flag) → `vars` in
  `wrangler.jsonc`.
- **Anything the browser needs** → a `VITE_`-prefixed var. Vite inlines only
  `VITE_*`, which is exactly why `CLERK_SECRET_KEY` (no `VITE_`) can never cross
  into `dist/`. Treat every `VITE_*` value as public — the Clerk **publishable**
  key (`VITE_CLERK_PUBLISHABLE_KEY`) is fine here; a secret never is.

## Worked example — add a new secret

Say a new route needs `RESEND_API_KEY`.

**1. Local dev** — add it to `.dev.vars` (gitignored):

```
RESEND_API_KEY=re_your_local_key
```

**2. Production** — set it as an encrypted secret:

```bash
wrangler secret put RESEND_API_KEY
```

**3. Regenerate the `Env` type** so `c.env.RESEND_API_KEY` type-checks:

```bash
pnpm cf-typegen        # wrangler types → worker-configuration.d.ts
```

**4. Access it in a route** via the per-request env — never a module-scope read
(the binding only exists at request time):

```ts
app.get('/api/send', async (c) => {
  const key = c.env.RESEND_API_KEY
  // …
})
```

## Hard rule — nothing secret in git

No real secret or account ID is ever committed. This template ships only
`__NAME__` sentinels and `REPLACE_WITH_YOUR_*` placeholders, and the CI
**secret-scan** job (gitleaks + `scripts/secret-grep.sh`) fails the build on any
leaked key shape. `.dev.vars` is gitignored; the committed `.dev.vars.example`
documents the required names with empty values. If you need a client-visible
value, use `VITE_*` and confirm it is genuinely safe to publish.
</content>
