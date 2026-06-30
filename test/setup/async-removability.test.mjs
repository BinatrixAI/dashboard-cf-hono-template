// ASYNC-04 removability backstop — plain-node vitest suite.
//
// WHY node, not workerd: this test only READS committed source files from disk
// using node:fs / node:path. It never touches Cloudflare bindings, makes no
// network calls, and writes nothing. The 'setup' vitest project (environment:
// 'node', include: test/setup/**/*.test.mjs) is the correct home.
//
// WHAT it asserts: the async layer (src/server/async/) is removable without
// breaking the core dashboard because the ONLY coupling from the rest of the
// src TypeScript sources into the async layer is a single line-commented import
// in src/server/index.ts. There must be ZERO live (uncommented) couplings.
//
// Invariant source: 07-02-SUMMARY.md "ASYNC-04 Removability Evidence" section.
// Equivalent shell check (must return 0):
//   grep -rn 'server/async\|async/handlers' src/ --include='*.ts' \
//     | grep -v '^src/server/async/' \
//     | grep -vc '//'
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const srcDir = path.join(repoRoot, 'src')

/** Recursively collect all .ts files under a directory. */
function collectTsFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (entry.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

// Return all lines in the src TypeScript sources that reference the async layer
// ('server/async' or 'async/handlers'), EXCLUDING files that live inside
// src/server/async/ itself (they are the async layer — internal references
// there are expected), AND excluding lines that are line-comments (trimmed line
// starts with '//').
//
// Any line returned here is a LIVE coupling — a blocker for ASYNC-04.
function findLiveAsyncCouplings() {
  const asyncDir = path.join(srcDir, 'server', 'async')
  const allTsFiles = collectTsFiles(srcDir)

  const liveCouplings = []

  for (const file of allTsFiles) {
    // Skip files that ARE the async layer.
    if (file.startsWith(asyncDir + path.sep) || file === asyncDir) continue

    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes('server/async') && !line.includes('async/handlers')) continue
      // A live coupling: the trimmed line does NOT start with '//'
      const trimmed = line.trimStart()
      if (!trimmed.startsWith('//')) {
        liveCouplings.push({
          file: path.relative(repoRoot, file),
          lineNumber: i + 1,
          line: line.trimEnd(),
        })
      }
    }
  }

  return liveCouplings
}

// Return all lines in the src/client TypeScript sources that reference the
// async layer. src/client should have ZERO references (commented or live).
function findClientAsyncReferences() {
  const clientDir = path.join(srcDir, 'client')
  const clientTsFiles = collectTsFiles(clientDir)

  const refs = []
  for (const file of clientTsFiles) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('server/async') || line.includes('async/handlers')) {
        refs.push({
          file: path.relative(repoRoot, file),
          lineNumber: i + 1,
          line: line.trimEnd(),
        })
      }
    }
  }
  return refs
}

describe('ASYNC-04 async-layer removability invariant', () => {
  it('has zero live (uncommented) couplings to the async layer outside src/server/async/', () => {
    const live = findLiveAsyncCouplings()

    if (live.length > 0) {
      const detail = live
        .map((c) => `  ${c.file}:${c.lineNumber}: ${c.line}`)
        .join('\n')
      // Fail with a clear description of what was found.
      expect.fail(
        `Found ${live.length} live coupling(s) to the async layer outside src/server/async/.\n` +
          `Each line below is a blocker — it must be line-commented before the async layer can be safely removed:\n` +
          detail,
      )
    }

    expect(live).toHaveLength(0)
  })

  it('src/client contains zero references to the async layer (commented or live)', () => {
    const refs = findClientAsyncReferences()

    if (refs.length > 0) {
      const detail = refs
        .map((c) => `  ${c.file}:${c.lineNumber}: ${c.line}`)
        .join('\n')
      expect.fail(
        `Found ${refs.length} reference(s) to the async layer in src/client/.\n` +
          `The client bundle must never depend on server-only async infrastructure:\n` +
          detail,
      )
    }

    expect(refs).toHaveLength(0)
  })
})
