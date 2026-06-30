# Theming — tweakcn + Tailwind v4

This template ships **theme-agnostic**: a neutral-slate `theme.css` built entirely
from **Tailwind v4 `@theme inline` oklch CSS variables**, with **no
`tailwind.config.js` and no `postcss.config.js`** committed anywhere. There is no
locked brand color — rebranding is a per-project *swap*, not a rebuild.

tweakcn is a **web tool** ([tweakcn.com](https://tweakcn.com)), **not an npm
dependency**. You never `install` or `codegen` it. The workflow is
**generate → export → commit**: design a palette in the browser, export the
Tailwind v4 oklch CSS, paste it into `theme.css`, and commit the matching shadcn
registry preset. The tokens live as CSS custom properties in `:root` / `.dark` and
are mapped to utilities via `@theme inline` (see `src/client/styles/theme.css`).

| Artifact | Role | Committed? |
| -------- | ---- | ---------- |
| `src/client/styles/theme.css` | Live oklch tokens (`:root` / `.dark` / `@theme inline`) | Yes — neutral-slate default |
| `src/client/styles/tweakcn-preset.json` | shadcn `registry:style` preset mirroring `theme.css` | Yes — the Phase-5 swap target |

> The committed default is the **neutral slate** palette. A brand theme is a
> per-project swap (Phase 5 `setup.mjs`), never committed as the template default.
> The shipped `tweakcn-preset.json` mirrors the current `theme.css` slate values, so
> a project that *does not* swap renders identically to one that re-applies the
> default preset.

## Generate → export → commit workflow

The browser tool is the source of truth for a palette; the oklch CSS is pasted into
`theme.css` and the registry JSON is committed alongside it. This is the
**generate → export → commit** loop (D-02), **not** an install/codegen step.

```
tweakcn.com  ──"Code" export (Tailwind v4 + oklch)──►  theme.css (:root / .dark + @theme inline)
                                                  └──►  tweakcn-preset.json  ──Phase 5 setup.mjs──►  branded theme
   (design in browser)        (paste-ready CSS)          (shadcn registry:style)   (consumes the preset)
```

### 1. Generate on tweakcn.com

Design the palette in the browser. In the **"Code"** / export dialog, select the
**Tailwind v4** target and **oklch** color format (toggle away from v3 / HSL). This
produces the same shape the template already uses — a `:root { … }` + `.dark { … }`
block plus the `@theme inline` mappings.

### 2. Export the v4 oklch CSS into `theme.css`

Copy the exported `:root` / `.dark` / `@theme inline` block and paste it into
`src/client/styles/theme.css`, replacing the existing tokens. Keep the values as
**oklch** — do **not** convert to hex, and do **not** add a `tailwind.config.js`
(the locked stack forbids it; a config file would break the v4 export contract).

```css
/* src/client/styles/theme.css (excerpt — values come from tweakcn) */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --primary: oklch(0.208 0.042 265.755);
  /* …rest of the light tokens… */
}
.dark {
  --background: oklch(0.129 0.042 264.695);
  --primary: oklch(0.929 0.013 255.508);
  /* …rest of the dark tokens… */
}
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* …maps each oklch var to a Tailwind utility… */
}
```

### 3. Commit the preset JSON

tweakcn also serves a **shadcn registry item** at
`https://tweakcn.com/r/themes/<theme-id>.json` (installable via
`npx shadcn@latest add <url>`). Save that JSON to
`src/client/styles/tweakcn-preset.json`. It is the structured, machine-parseable
form of the same palette — the `cssVars.{theme,light,dark}` map mirrors exactly what
you pasted into `theme.css`.

```bash
# fetch the registry item for your theme and commit it as the preset
curl -s https://tweakcn.com/r/themes/<theme-id>.json \
  > src/client/styles/tweakcn-preset.json
```

```jsonc
// src/client/styles/tweakcn-preset.json (shape — keys are bare, no `--` prefix)
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "default-slate",
  "type": "registry:style",
  "cssVars": {
    "theme": { "radius": "0.625rem", "font-inter": "'Inter', 'sans-serif'" },
    "light": { "background": "oklch(1 0 0)", "primary": "oklch(0.208 0.042 265.755)" },
    "dark":  { "background": "oklch(0.129 0.042 264.695)", "primary": "oklch(0.929 0.013 255.508)" }
  }
}
```

## Phase-5 contract (read this)

> **Stable swap contract.** Phase 5 `setup.mjs` reads
> `src/client/styles/tweakcn-preset.json` to rebrand a forked project. The contract
> is fixed:
>
> - **Path:** `src/client/styles/tweakcn-preset.json`
> - **Schema:** shadcn `registry:style` (`"type": "registry:style"`) with a
>   `cssVars` object exposing `theme`, `light`, and `dark` sub-objects.
> - **Colors:** color tokens are **oklch literals**, except the `sidebar*` tokens,
>   which are `var(--<token>)` indirections that inherit from their base tokens.
>   `setup.mjs` must pass `var(--*)` values through verbatim and only oklch-parse
>   literal values. Keys are **bare** token names with the leading `--` stripped
>   (`background`, not `--background`).
> - **Default = current `theme.css`:** the shipped preset mirrors the live slate
>   tokens, so `setup.mjs` re-applying the default is a no-op against the shipped
>   stylesheet.
>
> Keep this path and shape stable — `setup.mjs` will `JSON.parse` the file and
> regenerate `theme.css` as follows:
>
> - `:root` is written from `cssVars.light`, `.dark` from `cssVars.dark`, and the
>   `@theme inline` `font-*` declarations plus the base `--radius` from
>   `cssVars.theme` (which carries **only** `radius`, `font-inter`, `font-manrope`).
> - The rest of `@theme inline` is **not** sourced from `cssVars`. The
>   `--radius-{sm,md,lg,xl}` scale is templated as `calc(var(--radius) ± Npx)`, and
>   the ~30 `--color-*: var(--*)` utility mappings are generated **mechanically**,
>   one `--color-<token>` per token key in the `light`/`dark` set. `setup.mjs` must
>   emit these from the token-key set — it must not expect them in `cssVars.theme`,
>   or it will drop every Tailwind color utility.

## Light / dark mode

Dark mode is driven by the **`.dark` class** on `<html>`, toggled by the
`ThemeProvider` (cookie `vite-ui-theme`, default `system`). Keep the default as
`system` — it follows `prefers-color-scheme` and avoids a flash for forkers. The CSS
`color-scheme` property is set per mode so native UI (scrollbars, form controls, and
the Clerk widgets below) track light/dark:

```css
/* src/client/styles/index.css */
:root { color-scheme: light; }
.dark { color-scheme: dark; }
```

A tweakcn export **must include both** the `light` and `dark` token sets — exporting
only one half leaves the other mode on the previous palette. Both `cssVars.light` and
`cssVars.dark` are therefore required in the preset.

The two sets need **not** be key-symmetric, however. The `sidebar*` tokens are
intentionally mode-agnostic `var(--<token>)` indirections defined once (in
`cssVars.light`, mirroring `theme.css`'s `:root`) and resolved at runtime against
the base tokens, which each mode overrides. The shipped default therefore defines
the eight `sidebar*` keys only in `cssVars.light`, and `cssVars.dark` omits them by
design — the dark sidebar still tracks the dark palette through those `var()`
references. `setup.mjs` must **not** assume light/dark key symmetry or treat a
missing dark `sidebar*` key as an error.

## Clerk auth pages inherit the theme

The Clerk `<SignIn/>` / `<SignUp/>` widgets are themed via Clerk's official `shadcn`
theme (wired on `<ClerkProvider appearance={{ theme: shadcn }}>` in main.tsx).
That theme consumes the **same** shadcn CSS variables (`--primary`,
`--background`, `--radius`, …) the dashboard uses, so a tweakcn brand swap — which
rewrites those oklch vars in `theme.css` — flows through to the auth pages
**automatically, with no extra mapping** (D-08). Dark mode reaches Clerk through the
`color-scheme` rules above; no per-widget theme object is needed.
