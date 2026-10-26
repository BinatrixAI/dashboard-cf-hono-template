import type { ZodType } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { t } from './i18n'

/**
 * Copied from the installed hono 4.13.13 (`node_modules/hono/dist/validator/validator.js`,
 * `jsonRegex`), including its `i` flag; only escapes ESLint calls useless are dropped, which
 * changes nothing it matches. hono reads a json body ONLY when the Content-Type matches this,
 * otherwise it hands the schema `{}`. A looser regex would wave through a body hono never
 * parsed; a stricter one would 400 a body it did. Re-copy it on every hono bump (RESEARCH
 * Pitfall 1). mechinot-portal's copy came from hono 4.12.27, which had no `i` flag.
 */
const HONO_JSON_CONTENT_TYPE =
  /^application\/([a-z-.]+\+)?json(;\s*[a-zA-Z0-9-]+=([^;]+))*$/i

/**
 * The localized `zValidator`. Import this, never `@hono/zod-validator` directly (ESLint
 * enforces it in src/server; SEC-04, D-05).
 *
 * - Why the hook: without one, a failure returns the raw `safeParse` result, which leaks
 *   Zod issues, schema field paths and the caller's rejected values. The hook replaces that
 *   body with the `{ error, path }` envelope. The `!result.success` guard is load-bearing:
 *   returning nothing lets a valid request through.
 * - Why messages resolve here, not in the schemas: src/shared schemas are imported by the
 *   client, so schema-time messages would drag the server catalog into the bundle.
 * - Why the Content-Type guard: hono hands the schema `{}` for a non-JSON or missing
 *   Content-Type; the guard turns that into the localized 400 instead of letting the schema
 *   validate it. It does not make PUT partial: a JSON body that omits sections, even `{}`,
 *   still passes a defaulted schema such as settingsSchema, and the route stores the defaults
 *   (see routes/settings.ts).
 *
 * `v` takes exactly `(target, schema)`; extra arguments are a type error, because the
 * localized hook is fixed and a passed-in hook would otherwise be silently ignored (WR-05).
 */
export const v = <T extends keyof ValidationTargets, S extends ZodType>(
  target: T,
  schema: S
) =>
  zValidator(target, schema, (result, c) => {
    const wrongContentType =
      (result.target as string) === 'json' &&
      !HONO_JSON_CONTENT_TYPE.test(c.req.header('content-type') ?? '')

    if (!result.success || wrongContentType) {
      return c.json({ error: t(c, 'invalidBody'), path: c.req.path }, 400)
    }
  })
