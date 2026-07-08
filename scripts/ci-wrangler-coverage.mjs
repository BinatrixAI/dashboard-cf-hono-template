// ci-wrangler-coverage.mjs — Phase 17 CICD-06 gate (D-07).
// Enumerates every wrangler.* config in the tree and fails if any is NOT in
// SUBSTITUTION_FILESET — i.e. a new Worker config landed that setup.mjs does not
// parameterize and the sentinel/secret scans would therefore never scan. Imports
// the fileset from setup.mjs (single source of truth — NO second hardcoded list,
// mirroring ci-sentinel-scan.mjs's doctrine). Scan root: argv[2], default cwd.
// Exit 1 (naming the offender) on any uncovered wrangler.*; exit 0 on a clean scan.
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { SUBSTITUTION_FILESET } from '../setup.mjs'

// Directories that hold build output / installed deps / narrative docs — their wrangler.* files
// are not real Worker source configs. Mirrors setup.mjs's EXEMPT_PATHS directory prefixes
// (WR-17-04): `docs/` and `.planning/` are exempt there too, so a wrangler.*-named documentation
// example or phase-artifact snapshot dropped under either must not be flagged as "uncovered".
const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', '.git', 'docs', '.planning'])

function findWranglerFiles(root) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name))
      } else if (/^wrangler\.[^/]+$/.test(entry.name)) {
        found.push(path.relative(root, path.join(dir, entry.name)))
      }
    }
  }
  walk(root)
  return found
}

const root = process.argv[2] ?? process.cwd()
const covered = new Set(SUBSTITUTION_FILESET)
const uncovered = findWranglerFiles(root)
  .map((p) => p.split(path.sep).join('/')) // normalize for the forward-slash fileset
  .filter((rel) => !covered.has(rel))

if (uncovered.length) {
  console.error(
    `Uncovered wrangler.* config(s) — add to SUBSTITUTION_FILESET in setup.mjs:\n${uncovered.join('\n')}`,
  )
  process.exit(1)
}

console.log('wrangler.* coverage clean — every config is in SUBSTITUTION_FILESET.')
