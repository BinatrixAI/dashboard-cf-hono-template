# Async Layer — Cron → Queues → Resend

This template ships a complete **Cron → Queues → Resend** background-email example
that is **DORMANT by default**. The handler code in `src/server/async/` is live and
unit-tested, but the platform wiring is commented out, so a fresh fork deploys clean
with nothing firing. This doc covers both **activation** (opt into background jobs)
and **removal** (delete the layer entirely).

| Binding name (sentinel) | Resource | Purpose |
| ----------------------- | -------- | ------- |
| `__QUEUE_BINDING__`     | Queue (producer + consumer) | Carries the digest message from the Cron trigger to the consumer |
| `__DLQ_BINDING__`       | Queue (dead-letter)         | Receives messages that still fail after `max_retries` |
| `RESEND_API_KEY`        | `wrangler secret`           | Resend API key for outbound email (never committed) |

> The binding **names** are `__QUEUE_BINDING__` / `__DLQ_BINDING__` sentinels — the
> same two-tier convention as the D1/KV bindings (see
> [`docs/data-layer.md`](data-layer.md)). Phase 5 `setup.mjs` renames the binding
> names for a forked project; the dormant blocks below carry the sentinels inside
> JSONC comment tails so the sentinel scan stays clean until you activate.

## How it ships dormant

- **Handler code is live + tested.** `src/server/async/{messages,email,handlers}.ts`
  is compiled, linted, and covered by the Vitest workers pool — it is real code, not
  a stub.
- **Only the wiring is commented.** `src/server/index.ts` keeps `export default app`
  LIVE; the `{ fetch, scheduled, queue }` reshape and the `./async/handlers` import
  sit inside a comment block. `wrangler.jsonc` carries the `triggers.crons` /
  `queues.producers` / `queues.consumers` (+ `dead_letter_queue`) blocks commented.
- **Result:** with no `triggers.crons` / `queues.consumers` declared, the platform
  never invokes `scheduled()` / `queue()`, so a fresh project deploys inert.

---

## Activation (ASYNC-03)

Follow these steps **in order**. Steps 1–2 must happen before deploy, or an armed
consumer would reference a queue that does not exist.

### 1. Create the queue + dead-letter queue

The consumer points at a `dead_letter_queue`, so the DLQ must exist **before** you
arm the consumer — otherwise failed messages have nowhere to land.

```bash
wrangler queues create <your-queue>       # matches the __QUEUE_BINDING__ queue name
wrangler queues create <your-queue>-dlq   # matches __DLQ_BINDING__ (dead-letter queue)
```

### 2. Uncomment the wiring

- **`src/server/index.ts`** — swap the LIVE `export default app` for the handler
  object, and uncomment the import directly above it:

  ```ts
  import { scheduled, queue } from './async/handlers'

  export default {
    fetch: app.fetch,   // existing Hono API + SPA assets — unchanged
    scheduled,          // Cron Trigger entry (enqueues a digest message)
    queue,              // Queue consumer entry (drains batch -> Resend)
  } satisfies ExportedHandler<Env>
  ```

  > `app.fetch` is passed **unwrapped** (do not wrap it in another function). The
  > import MUST move to module top once you activate — while dormant it stays inside
  > the comment so an unused import never trips `noUnusedLocals` / eslint on a fresh
  > fork.

- **`wrangler.jsonc`** — uncomment the `triggers.crons`, `queues.producers`, and
  `queues.consumers` (incl. `dead_letter_queue`) blocks. They ship pinned to:

  ```jsonc
  "triggers": {
    "crons": ["0 9 * * *"]              // daily 09:00 UTC — adjust to your job
  },
  "queues": {
    "producers": [
      { "binding": "__QUEUE_BINDING__", "queue": "__QUEUE_BINDING__" }
    ],
    "consumers": [
      {
        "queue": "__QUEUE_BINDING__",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "__DLQ_BINDING__"   // failed messages land here after max_retries
      }
    ]
  }
  ```

- **Regenerate the binding types** so `Env` picks up the new producer binding:

  ```bash
  wrangler types
  ```

### 3. Set the Resend secret

The Resend API key is a **server-only secret**. Set it via `wrangler secret put` —
never commit a value, never `VITE_`-prefix it. This mirrors how `CLERK_SECRET_KEY`
is handled (declared empty in `.dev.vars.example`, set as a secret in production).

```bash
wrangler secret put RESEND_API_KEY
```

> Resend requires a **verified sender domain**. The example helper uses a
> `onboarding@resend.dev` placeholder `from:` address that works for testing — swap
> in a verified domain in your Resend dashboard before sending real mail.

### 4. Deploy

```bash
pnpm deploy
```

The Cron trigger now fires on the pinned schedule, enqueues a digest message, and the
consumer drains the batch and sends via Resend. Messages that still fail after
`max_retries: 3` land in `__DLQ_BINDING__`.

### Hardening: validate external input

The shipped producer enqueues a fixed internal digest message. If your fork's producer
accepts **external input** (e.g. a webhook body becomes the queue message), Zod-validate
the message body **before** sending it to Resend, so malformed or hostile input can
never reach the outbound email path (RESEARCH Open Q1 / §V5).

---

## Removal (ASYNC-04)

To remove the async layer entirely:

1. Delete the handler directory: `src/server/async/`.
2. Delete the commented `triggers.crons` / `queues` blocks in `wrangler.jsonc`.
3. Delete the commented arming block in `src/server/index.ts` (keep
   `export default app`).

The core dashboard is **unaffected** — nothing else imports the async layer. There is
exactly one coupling point (the commented `import { scheduled, queue } from
'./async/handlers'` in `index.ts`), so once `src/server/async/` and the commented
blocks are gone, no live importer remains.
