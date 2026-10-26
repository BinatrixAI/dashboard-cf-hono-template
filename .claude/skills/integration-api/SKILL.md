---
name: integration-api
description: Design reference for the template's optional integration-API Worker — the closed-perimeter M2M auth stack (Cloudflare Access service tokens, hashed API keys in KV, HMAC, mTLS) and the outbound connector patterns for Zoho CRM, Monday.com, and Resend. Use when adding, wiring, or securing the second Worker under integration-api/, when choosing how n8n or another machine client authenticates to it, or when building an outbound connector.
---

# Integration-API Module

Migrated out of `.claude/CLAUDE.md` so it loads on demand instead of every session.
The module is optional and not yet present in the repo — this is the design contract for building it.

## Integration-API Module — Base + Auth

### Base: plain Hono Worker (not a framework)

### M2M / closed-perimeter auth — layered recommendation

| Pattern | What it is | Tradeoffs | Verdict |
|---|---|---|---|
| **Cloudflare Access service tokens** (Zero Trust) | n8n sends `CF-Access-Client-Id` + `CF-Access-Client-Secret`; Cloudflare validates at the **edge before the Worker runs** | Strongest isolation (rejected traffic never hits your code/bill); central rotation in Zero Trust; **requires** Zero Trust setup; n8n stores token in an HTTP Header credential (documented, mild community friction) | **Primary — perimeter layer** |
| **Hashed API key in KV** | Caller sends `Authorization: Bearer <key>`; Hono middleware hashes + looks up in KV (store only SHA-256, never plaintext) | Simplest, portable, no Zero Trust dependency; you own rotation/revocation (delete KV entry); app-managed | **Secondary — app layer (defense in depth)** |
| **HMAC-signed requests** | Caller signs `timestamp + body` with a shared secret; server verifies + rejects stale timestamps | Replay protection + integrity; more client complexity | Use for **replay-sensitive inbound webhooks** only |
| **mTLS** | Client certificate auth | Highest assurance; operationally heavy (cert lifecycle), n8n support awkward | Skip unless a partner mandates it |

### How n8n authenticates to it

### Outbound connector patterns

- **Zoho CRM:** OAuth2 **refresh-token** flow. Store the long-lived refresh token as a `wrangler secret`; exchange for a short-lived access token; **cache the access token in KV with a TTL** (~55 min) to avoid re-minting per request. Region-aware base URLs (`.com`/`.eu`/etc.).
- **Monday.com:** GraphQL API with a **personal/API token** → simple `Authorization: <token>` bearer header; token in `wrangler secret`.
- **Resend:** API key in `wrangler secret`; reuse the same Resend client as the dormant async layer.
