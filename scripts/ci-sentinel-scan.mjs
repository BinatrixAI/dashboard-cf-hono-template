// ci-sentinel-scan.mjs — Phase 6 CICD-04 gate.
// Reuses the LOCKED Phase-5 scan contract: imports scanForSentinels() from
// setup.mjs so CI and the setup self-check can never drift (D-04, D-10). Defines
// NO sentinel regex of its own. The import is side-effect-free (setup.mjs isMain
// guard). Scan root: argv[2], defaulting to cwd. Exit 1 on any leftover identifier
// sentinel (__X__); exit 0 on a clean scan, reporting non-blocking REPLACE_WITH_YOUR_*.
import { scanForSentinels } from '../setup.mjs'

const root = process.argv[2] ?? process.cwd()
const { hardFails, outstanding } = scanForSentinels(root)

if (hardFails.length) {
  console.error(`Leftover identifier sentinels:\n${hardFails.join('\n')}`)
  process.exit(1)
}

console.log(
  `Sentinel scan clean. (${outstanding.length} non-blocking REPLACE_WITH_YOUR_* placeholders)`,
)
