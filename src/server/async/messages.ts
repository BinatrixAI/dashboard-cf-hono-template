// The message contract for the example "daily digest" job (D-01). Swap this shape for
// your own job's payload — it is the data the Cron producer enqueues and the Queue
// consumer drains.
export interface DigestMessage {
  to: string
  subject: string
  body: string
  generatedAt: string // ISO timestamp
}

// D-04 type seam — the queue PRODUCER binding is intentionally COMMENTED out of
// wrangler.jsonc, so `wrangler types` does NOT emit it into the generated global `Env`.
// (A declared producer binding would force the queue to exist at deploy and break a clean
// fork — Pitfall 2.) Augment `Env` locally so `env.__QUEUE_BINDING__.send()` compiles
// WITHOUT a declared queue, keeping `tsc -b` / `wrangler types` green on the unsubstituted
// template. `Env` and `Queue<T>` are both GLOBAL (from worker-configuration.d.ts /
// @cloudflare/workers-types) — no imports needed here.
export type AsyncEnv = Env & {
  __QUEUE_BINDING__: Queue<DigestMessage>
}
