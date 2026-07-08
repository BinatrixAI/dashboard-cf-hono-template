# dashboard-cf-hono-template

<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/release/BinatrixAI/dashboard-cf-hono-template.svg?size=sm&amp;mode=dark"><img alt="Release" src="https://www.shieldcn.dev/github/release/BinatrixAI/dashboard-cf-hono-template.svg?size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/ci/BinatrixAI/dashboard-cf-hono-template.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="CI" src="https://www.shieldcn.dev/github/ci/BinatrixAI/dashboard-cf-hono-template.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Language · TypeScript" src="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Bundler-Vite-646CFF.svg?logo=vite&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Bundler · Vite" src="https://www.shieldcn.dev/badge/Bundler-Vite-646CFF.svg?logo=vite&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Hosting-Cloudflare_Workers-F38020.svg?logo=cloudflare&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Hosting · Cloudflare Workers" src="https://www.shieldcn.dev/badge/Hosting-Cloudflare_Workers-F38020.svg?logo=cloudflare&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-TanStack_Query-FF4154.svg?logo=reactquery&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="TanStack Query" src="https://www.shieldcn.dev/badge/Stack-TanStack_Query-FF4154.svg?logo=reactquery&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-React-61DAFB.svg?logo=react&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="React" src="https://www.shieldcn.dev/badge/Stack-React-61DAFB.svg?logo=react&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Tailwind CSS" src="https://www.shieldcn.dev/badge/Stack-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>

[English](README.md) · **Русский**

Нейтральный к бренду, переиспользуемый **шаблон дашборда на Cloudflare**. Один
Cloudflare Worker отдаёт **Vite + React SPA** (TanStack Router, shadcn/ui, Tailwind v4,
готовность к RTL) как статические ассеты и направляет `/api/*` в **Hono**-API на том же
рантайме, опираясь на **D1** + **KV**, с аутентификацией **Clerk**, проверяемой на краю
сети (edge). Нажмите **Use this template**, запустите `setup.mjs`, создайте свои ресурсы —
и разверните корректно связанный дашборд в Cloudflare за считанные минуты.

> Репозиторий поставляется с сентинелами вида `__NAME__` и заглушками ID ресурсов
> `REPLACE_WITH_YOUR_*` — **никакие реальные секреты или ID аккаунтов не закоммичены**.
> `setup.mjs` подставит имена за вас; ID ресурсов вы вписываете после создания ресурсов
> D1/KV.

## Требования

- **pnpm** `10.25.0` (репозиторий фиксирует `packageManager` и коммитит `pnpm-lock.yaml`)
- **Node 22** (закреплён в `.nvmrc`; Vite 8 требует Node `^20.19 || >=22.12`)
- **Аккаунт Cloudflare** (для `wrangler` + ресурсов D1/KV)
- **Приложение Clerk** (для publishable- и secret-ключей)

## Быстрый старт

### 1. Использовать шаблон

Нажмите **«Use this template» → Create a new repository** на GitHub, затем клонируйте
свой новый репозиторий и установите зависимости:

```bash
pnpm install
```

### 2. Запустить скрипт настройки

`setup.mjs` — это одноразовый параметризатор без зависимостей. Он подставляет каждый
сентинел-идентификатор `__NAME__` (имена worker/пакета/биндингов) в значения вашего
проекта, генерирует `.dev.vars` из `.dev.vars.example`, записывает выбор переключателей
модулей и печатает чек-лист ресурсов для аккаунта.

```bash
node setup.mjs            # интерактивно в TTY
# либо полностью без диалога:
node setup.mjs --yes \
  --name my-dashboard \
  --app-name "My Dashboard" \
  --clerk-pk pk_test_your_publishable_key
```

Полезные флаги: `--d1-name`, `--kv-title`, `--theme`, `--dry-run` (предпросмотр без
записи) и `--force` (повторный запуск после появления `.setup-complete`). Запуск
**жёстко завершается с ошибкой на любом оставшемся сентинеле-идентификаторе** и сообщает
об ID ресурсов `REPLACE_WITH_YOUR_*` как о неблокирующих оставшихся действиях — их вы
заполняете на шаге 3.

### 3. Создать ресурсы Cloudflare

`setup.mjs` печатает готовый к копированию чек-лист с подставленными выбранными именами.
Он выглядит ровно так:

```bash
# 1. Создайте базу данных D1, затем вставьте возвращённый database_id в wrangler.jsonc
wrangler d1 create <your-d1-name>
#    → замените REPLACE_WITH_YOUR_D1_ID в wrangler.jsonc

# 2. Создайте KV-неймспейс, затем вставьте возвращённый id в wrangler.jsonc
wrangler kv namespace create <your-kv-title>
#    → замените REPLACE_WITH_YOUR_KV_ID в wrangler.jsonc

# 3. Задайте СЕКРЕТ Clerk (никогда не коммитится; .dev.vars оставляет его пустым)
wrangler secret put CLERK_SECRET_KEY

# 4. Перегенерируйте типы биндингов из заполненных биндингов
pnpm cf-typegen
```

Примените миграцию базы данных к каждому окружению (они никогда не синхронизируются —
см. [`docs/data-layer.md`](docs/data-layer.md)):

```bash
pnpm db:migrate:local    # D1 в workerd/miniflare (dev, тесты, CI) — заглушка ID подойдёт
pnpm db:migrate:remote   # реальный D1 — сначала требуется настоящий database_id
```

### 4. Разработка и деплой

```bash
pnpm dev                 # HMR для SPA + Hono Worker в workerd (@cloudflare/vite-plugin)
pnpm run deploy          # pnpm build && wrangler deploy → URL *.workers.dev
```

## Обзор архитектуры

**Один Worker** — это весь артефакт деплоя; отдельного хоста для фронтенда нет:

- **SPA как статические ассеты.** Сборка Vite/React отдаётся на краю сети из биндинга
  `ASSETS`. Несопоставленные запросы (не к ассетам) переписываются на `index.html`
  (`not_found_handling: "single-page-application"`) для клиентской маршрутизации.
- **Hono владеет `/api/*`.** `run_worker_first: ["/api/*"]` направляет эти запросы в
  Worker (Hono) **до** фолбэка на статические ассеты; всё остальное отдаётся как ассет
  бесплатно.
- **Биндинги D1 + KV.** D1 (SQLite) — реляционное хранилище для примера CRUD над `items`;
  KV хранит отдельный blob настроек приложения. Оба объявлены в `wrangler.jsonc` с
  заглушками ID. См. [`docs/data-layer.md`](docs/data-layer.md).
- **Clerk на краю сети.** `@hono/clerk-auth` проверяет сессию Clerk внутри Worker; SPA
  использует `@clerk/react`. Publishable-ключ — это открытый `var`; секрет — это
  `wrangler secret`.
- **Спящий асинхронный слой.** Путь Cron → Queues → Resend поставляется в
  `src/server/async/` (рабочий и покрытый юнит-тестами); обвязка платформы остаётся
  закомментированной, так что свежий форк деплоится инертным. Активируйте или удалите
  его по инструкции [`docs/async-layer.md`](docs/async-layer.md).
- **Опциональный CMS-Worker.** Второй, самодостаточный SonicJS-Worker живёт в `cms/`
  (собственные D1/KV/R2, Better-Auth `/admin`, публично читаемая коллекция
  `blog-posts`). Дашборд читает его REST API cross-origin через `VITE_CMS_API_URL`
  (страница `/content` под авторизацией + ссылка на админку в сайдбаре), а
  Clerk-независимые маршруты `/blog` отображают опубликованный контент. `setup.mjs`
  параметризует его; задеплойте `cms/`, чтобы включить, или пропустите целиком.
  См. [`docs/cms.md`](docs/cms.md).

Тема — это замена на уровне проекта (tweakcn → oklch-токены Tailwind v4), описана в
[`docs/THEMING.md`](docs/THEMING.md).

## Структура каталогов

Однопакетная раскладка — SPA, API и их общие контракты живут под одним `src/`, собираются
и деплоятся как один Worker:

```
├── src/
│   ├── client/                 # Vite + React SPA (отдаётся как статические ассеты)
│   │   ├── routes/             # файловые маршруты TanStack
│   │   │   ├── _authenticated/ #   страницы под защитой Clerk (protected)
│   │   │   └── (auth)/         #   вход / регистрация (публичные)
│   │   ├── features/           # модули-фичи (items, dashboard, settings, …)
│   │   ├── components/         # общий UI; components/ui/ = вендоренный shadcn
│   │   ├── main.tsx            # ClerkProvider + инициализация роутера
│   │   └── routeTree.gen.ts    # АВТОГЕНЕРАЦИЯ — не редактировать вручную
│   ├── server/                 # Hono API (владеет /api/*)
│   │   ├── index.ts            # регистрация роутеров = контракт порядка auth
│   │   ├── routes/             # роутеры по фичам + рядом лежащие *.test.ts
│   │   ├── middleware/         # requireAuth (шлюз на краю сети)
│   │   ├── db/                 # схема и запросы Drizzle
│   │   └── async/              # спящий слой Cron → Queues → Resend
│   └── shared/                 # Zod-схемы + типы, импортируемые обоими слоями
├── cms/                        # ОПЦИОНАЛЬНЫЙ SonicJS CMS-Worker — свои D1/KV/R2 + wrangler.jsonc (docs/cms.md)
├── migrations/                 # сгенерированный Drizzle SQL для D1 (+ закоммиченный meta/)
├── public/                     # статические файлы, копируемые в сборку как есть
├── scripts/                    # CI-помощники гигиены (secret-grep, sentinel scan, smoke)
├── test/                       # настройка Vitest workers-pool + помощники миграций
├── docs/                       # руководства, ссылки на которые ниже
├── .claude/skills/dashboard-dev/  # скилл Claude Code: рецепты расширения шаблона
├── wrangler.jsonc              # биндинги, ассеты, run_worker_first
├── components.json             # конфиг shadcn
├── .mcp.json                   # MCP-сервер shadcn (на время разработки)
└── setup.mjs                   # одноразовый параметризатор проекта
```

## Переключатели модулей

`setup.mjs` записывает ваши намерения по модулям в `.setup-config.json` (в gitignore). Он
записывает только выбор — на этом этапе он **не** редактирует `wrangler.jsonc`:

| Переключатель       | Эффект                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Async layer**     | Записывается сейчас; активируйте поставляемый спящий слой Cron → Queues → Resend через [`docs/async-layer.md`](docs/async-layer.md) |
| **Integration API** | **Заглушка-нооп для v2** — всегда записывается `false`; зарезервировано под будущий второй Worker                          |

## Работа с этим шаблоном (скилл Claude Code)

Репозиторий поставляется со **скиллом Claude Code `dashboard-dev`** в
[`.claude/skills/dashboard-dev/`](.claude/skills/dashboard-dev/SKILL.md). Если вы
используете Claude Code (или любого агента, читающего `.claude/skills/`), он
автоматически активируется, когда вы просите добавить страницу/маршрут, таблицу БД +
миграцию, API-эндпоинт, компонент shadcn или поработать с секретами — и отвечает точными
путями к файлам + командами именно для **этой** раскладки, а затем указывает на
подробные руководства ниже. Это самый быстрый способ разобраться в структуре, не читая
каждый документ. Не используете агента? Те же рецепты есть в `docs/` (ссылки далее).

## Документация

Подробные руководства живут в [`docs/`](docs/):

- **[`docs/adding-pages.md`](docs/adding-pages.md)** — основной how-to: анатомия
  страницы из 4 файлов и готовые к копированию рецепты для публичных/защищённых
  страниц, страницы с данными (полный путь), публичных API-эндпоинтов, данных KV и
  удаления/переименования демо-страниц.
- **[`docs/ui-components.md`](docs/ui-components.md)** — модель вендоренного shadcn/ui,
  добавление компонентов через `pnpm dlx shadcn@latest add` и MCP shadcn.
- **[`docs/secrets.md`](docs/secrets.md)** — `.dev.vars` vs `wrangler secret put` vs
  `vars` в `wrangler.jsonc` vs `VITE_*`, с разобранным примером добавления секрета.
- **[`docs/THEMING.md`](docs/THEMING.md)** — темизация tweakcn + Tailwind v4: процесс
  генерация → экспорт → коммит, светлый/тёмный режим и как страницы аутентификации Clerk
  наследуют тему.
- **[`docs/data-layer.md`](docs/data-layer.md)** — D1 + KV: процесс схема → миграция
  (Drizzle + wrangler), `--local` vs `--remote` и хранилище настроек в KV.
- **[`docs/async-layer.md`](docs/async-layer.md)** — спящий слой Cron → Queues → Resend:
  активация (создать очередь + DLQ → раскомментировать обвязку → `wrangler secret put
  RESEND_API_KEY` → деплой) и заметка об удалении.
- **[`docs/cms.md`](docs/cms.md)** — опциональный SonicJS CMS-Worker (`cms/`):
  последовательность деплоя без 500 (создать D1/R2/KV → задать `BETTER_AUTH_SECRET`/
  `JWT_SECRET` → миграции → сид админа → деплой), первичная настройка + ротация админа,
  усиление регистрации и связка контента дашборд/публичные страницы.

## CI/CD + деплой

### Гейт качества (GitHub Actions)

`.github/workflows/ci.yml` запускается при каждом push в `main` и на pull request'ах. Это
три параллельных задания, и они **не держат учётных данных Cloudflare — они никогда не
деплоят**:

- **quality-gate** — `cf-typegen` → `typecheck` (`tsc -b`) → `lint` → `format:check` →
  `test` (Vitest workers pool против реальных моков биндингов D1/KV). Проходит зелёным на
  шаблоне без `setup` как есть.
- **secret-scan** — MIT-бинарник gitleaks (`.gitleaks.toml`) плюс проверяемый
  `scripts/secret-grep.sh`.
- **sentinel-scan** — разворачивает копию дерева через `setup.mjs --yes` во временный
  каталог, затем запускает `scripts/ci-sentinel-scan.mjs` против неё (никогда напрямую по
  дереву шаблона — шаблон законно всё ещё содержит сентинелы).

### Деплой (Cloudflare Workers Builds)

Деплой — это **отдельный путь** от гейта качества. Для v1 этот шаблон поставляет
**конфигурацию сборки + эту задокументированную процедуру** — подключение репозитория к
Workers Builds делается один раз вручную в дашборде Cloudflare:

1. В дашборде Cloudflare перейдите в **Workers & Pages → ваш Worker → Settings →
   Builds** и подключите свой репозиторий GitHub.
2. Задайте **build command** `pnpm build` и **deploy command** `wrangler deploy` (скрипт
   `deploy` — `pnpm build && wrangler deploy` — уже существует).
3. Убедитесь, что **имя Worker совпадает с `name` в `wrangler.jsonc`** (значение, которое
   `setup.mjs` задал из `--name`), иначе Workers Builds создаст/задеплоит не тот Worker.

После этого push в `main` собирает и деплоит автоматически.

### Ручной деплой (запасной путь)

Вы всегда можете задеплоить вручную — именно так доказывается Definition of Done шаблона:

```bash
pnpm run deploy          # pnpm build && wrangler deploy → URL *.workers.dev
```

Порядок деплоя важен для секрета Clerk: `wrangler deploy` (создаёт Worker) →
`wrangler secret put CLERK_SECRET_KEY` → секрет применяется вживую без повторного деплоя.
Publishable-ключ поставляется как открытый `var`, уже заполненный `setup.mjs`.

## Устранение неполадок

- **CI sentinel-scan падает на оставшемся сентинеле `__NAME__`.** Вы не запускали
  `setup.mjs` (или проскользнул новый сентинел). Запустите `node setup.mjs` — он
  перечислит каждый `file:line`, который не смог разрешить, и жёстко упадёт, пока все они
  не будут подставлены.
- **`wrangler deploy` / `--remote` падает на `REPLACE_WITH_YOUR_D1_ID` (или id KV).**
  Это намеренные заглушки. Запустите `wrangler d1 create` /
  `wrangler kv namespace create`, вставьте возвращённые `database_id` / `id` в
  `wrangler.jsonc`, затем `pnpm cf-typegen`. (Заглушка подходит для всей `--local`
  разработки, тестов и CI — реальный ID нужен только для `--remote`/продакшена.)
- **401 / аутентификация падает после деплоя.** Не задан секрет Clerk. Запустите
  `wrangler secret put CLERK_SECRET_KEY`. Publishable-ключ (`CLERK_PUBLISHABLE_KEY`) —
  это открытый `var`, заданный `setup.mjs --clerk-pk`, и он уезжает вместе с деплоем.
- **Строка, записанная в dev, «пропала» в продакшене.** `--local` и `--remote` D1 — это
  две базы, которые никогда не синхронизируются; запустите `pnpm db:migrate:remote`
  (после заполнения реального `database_id`). См. [`docs/data-layer.md`](docs/data-layer.md).

## Definition of Done

Одноразовый проект, развёрнутый из этого шаблона через `setup.mjs`, деплоится вживую в
Cloudflare и:

- [ ] **Аутентификация грузится** — страница входа Clerk рендерится по развёрнутому URL.
- [ ] **Hono API отвечает** — `/api/*` возвращается из Worker (например, маршрут items
      или settings).
- [ ] **Чтение из D1 успешно** — данные примера `items` приходят из развёрнутой базы D1.
