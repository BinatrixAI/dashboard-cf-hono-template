# UI Components — shadcn/ui

The dashboard UI is built on **shadcn/ui** (`new-york` style). shadcn is not a
runtime dependency — components are **vendored** into the repo as source you own
and edit. This template ships **31** primitives in
`src/client/components/ui/`.

## The vendored model

`components.json` records the project config (style `new-york`, base color
`slate`, icon library `lucide`, and the `@/components/ui` alias). Every component
under `src/client/components/ui/` is plain source — there is no `shadcn` package
to upgrade. To change a button's look, edit `button.tsx`.

**Use what's already vendored first.** Before adding anything, check
`src/client/components/ui/` — the base already ships table, dialog, alert-dialog,
form, input, select, skeleton, textarea, and 20-plus more.

## Adding a missing component

When you genuinely need a primitive that isn't vendored yet, add it with the
shadcn CLI (it reads `components.json`, so paths + style are correct
automatically):

```bash
pnpm dlx shadcn@latest add date-picker
```

**RTL and imports.** `components.json` sets `"rtl": true`, so `add` emits
logical classes (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`)
plus `rtl:` fixes, and the component works in Hebrew without hand-editing.
Registry components import Radix primitives from the unified `radix-ui` package
as namespaces (`import { Popover as PopoverPrimitive } from 'radix-ui'`) and
`cn` from the `cn` package; app code keeps importing `cn` from `@/lib/utils`.
Two things still need a human eye: the CLI does not fully convert calendar and
sidebar, so check those (and any sheet slide animation) in Hebrew; and
`Tooltip` no longer wraps itself in a `TooltipProvider`, so a tooltip used
outside the authenticated layout needs one.

**Review the CLI's extra edits.** Run `git diff` after `add`. The CLI may also
rewrite `src/client/styles/index.css`, create files such as
`hooks/use-mobile.ts`, or add or downgrade packages (for example next-themes for
sonner). Revert those: keep the tweakcn theme in `index.css` and keep
`@/context/theme-provider`.

The component lands in `src/client/components/ui/` and is yours to edit. Commit
it like any other source file.

> Use the current `shadcn` CLI — **not** the deprecated `shadcn-ui` name.

## Registry usage & theming

The same `add` command installs from any shadcn **registry URL**, including
tweakcn theme presets:

```bash
pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/<theme-id>.json
```

Theme tokens (the tweakcn → Tailwind v4 oklch workflow) are already documented in
[`docs/THEMING.md`](THEMING.md) — follow that for colors/radius; don't duplicate
it here.

## The shadcn MCP

This template ships a root `.mcp.json` that registers the **shadcn MCP server**:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

When you open a fork in an MCP-aware AI client (Claude Code, Cursor, etc.), it
offers to start this dev-time server, giving the assistant direct access to the
shadcn component registry — so it can browse and scaffold components for you
instead of guessing markup.

Example prompt: **"add a date-picker via the shadcn MCP and wire it into the
reports filter."**

## Best practices

- **Compose, don't reinvent.** Build features from the existing `ui/`
  primitives; only `add` a new primitive when nothing composes.
- **Icons are `lucide-react` only** (matches `components.json` `iconLibrary`).
  Keep glyphs distinct across sidebar entries.
- **Forms** = `ui/form.tsx` + `react-hook-form` + a **shared Zod schema** from
  `src/shared/` (the same schema the API validates against — see
  [`docs/adding-pages.md`](adding-pages.md)).
- **Data tables** — copy the `items` feature's table components as the reference
  pattern.
- **RTL awareness.** The shell is direction-aware (Hebrew/RTL supported via the
  `DirectionProvider`). Prefer logical Tailwind utilities (`ms-`/`me-`,
  `start`/`end`) over hard `left`/`right` so components mirror correctly.
- **i18n (English ↔ Hebrew).** The LTR/RTL toggle is also the language switch —
  LTR = English, RTL = Hebrew. New UI strings go in **both** `en.json` and
  `he.json` (a parity test enforces it). See [`docs/i18n.md`](i18n.md).
</content>
