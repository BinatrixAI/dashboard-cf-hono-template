// GUARD (CF-03 / D-05): the deploy chain must be entered through its lifecycle script.
//
// pnpm ships a built-in workspace-deploy command that SHADOWS `scripts.deploy`. Verified on
// pnpm 10.25.0: the un-prefixed `pnpm deploy` exits 1 with
// `ERR_PNPM_CANNOT_DEPLOY  A deploy is only possible from inside a workspace` — loud today,
// and every gate in the chain is skipped. Once this repo becomes a workspace (e.g. the
// optional integration-api/ Worker gets its own package), the built-in stops erroring and the
// skip goes SILENT. Hence a script rather than a memory.
//
// The check is `npm_lifecycle_event` alone: being outside a script run is the failure mode,
// not which package manager ran us.
const event = process.env.npm_lifecycle_event

if (event !== 'deploy') {
  console.error(
    `ABORT: the deploy chain was not entered through its lifecycle script (npm_lifecycle_event=${event ?? '<unset>'}).\n` +
      `Deploy with:  pnpm run deploy\n` +
      `Any other route skips the migration, quality and live-key gates.`
  )
  process.exit(1)
}
