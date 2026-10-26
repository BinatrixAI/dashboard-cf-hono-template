#!/usr/bin/env node
// bundle-size.mjs — CICD-07 gzipped JS ceilings (D-07..D-10).
// Runs in CI right after `pnpm build`; never part of `pnpm test` or the deploy gate (D-10).
// Two ceilings: initial JS (the module entry in index.html + every modulepreload it lists, the
// real first-visit cost) and total JS (every assets/*.js). The bare entry is printed, not gated.
// The entry is read from index.html, not a Vite manifest (that would ship as a public asset).
// Size = zlib.gzipSync at the default level — the same method set the baseline (Pitfall 5).
// EXIT: 0 within ceilings; 1 over a ceiling; 2 nothing measured (no <dir>/index.html).
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

// Raise on purpose: edit here and say why in the commit (D-08).
// Baseline 2026-10-26 (measure() on a fresh build): initial 268,284 B, total 668,998 B; each ceil(×1.1).
export const CEILINGS = { initialGzip: 295113, totalGzip: 735898 }

const gz = (file) => gzipSync(readFileSync(file)).length

/** Gzipped sizes of the built SPA under clientDir (e.g. dist/client). */
export function measure(clientDir) {
  const html = readFileSync(path.join(clientDir, 'index.html'), 'utf8')
  const tags = html.match(/<(script|link)\b[^>]*>/g) ?? []
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
  const entry = tags.find((t) => t.startsWith('<script') && attr(t, 'type') === 'module')
  const entrySrc = entry && attr(entry, 'src')
  if (!entrySrc) throw new Error(`no <script type="module" src> in ${clientDir}/index.html`)
  const preloads = tags
    .filter((t) => t.startsWith('<link') && attr(t, 'rel') === 'modulepreload')
    .map((t) => attr(t, 'href'))
    .filter(Boolean)
  const local = (url) => path.join(clientDir, url.replace(/^\//, ''))

  const entryGzip = gz(local(entrySrc))
  const initial = [...new Set([entrySrc, ...preloads])]
  const assets = path.join(clientDir, 'assets')
  const totalJs = readdirSync(assets).filter((f) => f.endsWith('.js'))
  return {
    entryGzip,
    initialGzip: initial.reduce((sum, u) => sum + gz(local(u)), 0),
    totalGzip: totalJs.reduce((sum, f) => sum + gz(path.join(assets, f)), 0),
    initialFiles: initial.length,
    totalFiles: totalJs.length,
  }
}

const fmt = (n) => n.toLocaleString('en-US')

/** [] when within ceilings, else one message per breach. */
export function check(m, c = CEILINGS) {
  return [
    ['initial', m.initialGzip, c.initialGzip],
    ['total', m.totalGzip, c.totalGzip],
  ]
    .filter(([, got, max]) => got > max)
    .map(
      ([label, got, max]) =>
        `${label} JS ${fmt(got)} B gzipped > allowed ${fmt(max)} B. Raise CEILINGS in scripts/bundle-size.mjs on purpose (D-08).`
    )
}

/** CLI body; returns the exit code, never calls process.exit. */
export async function run(argv) {
  const clientDir = argv[0] ?? 'dist/client'
  if (!existsSync(path.join(clientDir, 'index.html'))) {
    process.stderr.write(`bundle-size: no ${clientDir}/index.html — run pnpm build first\n`)
    return 2
  }
  const m = measure(clientDir)
  process.stdout.write(
    `entry JS   ${fmt(m.entryGzip)} B gzipped (information only)\n` +
      `initial JS ${fmt(m.initialGzip)} / ${fmt(CEILINGS.initialGzip)} B gzipped (${m.initialFiles} files)\n` +
      `total JS   ${fmt(m.totalGzip)} / ${fmt(CEILINGS.totalGzip)} B gzipped (${m.totalFiles} files)\n`
  )
  const breaches = check(m)
  for (const b of breaches) process.stderr.write(`BUNDLE OVER CEILING: ${b}\n`)
  return breaches.length ? 1 : 0
}

// CLI entry only — importing this module runs nothing. exitCode (not exit) so stdout flushes.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2))
}
