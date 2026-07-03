# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repo is the **Doppel selfbot** — the Slack account that runs Hack Club's "Doppel" YSWS ("You Ship, We Ship") program end-to-end. Doppel challenges teenagers to build a Slack selfbot of their own: automation running on a real user account (via a user `xoxp-*` token or a session `xoxd-*` cookie token) rather than a bot account, so it can do things regular bots can't — join huddles, hit undocumented internal endpoints, manipulate read state, etc. Participants pick a category of "witchcraft" to focus on, log hours via Hackatime, and submit a GitHub repo + demo when done. Hours coded unlock tiered prizes (3h → custom pfp, up through 20h → USB Rubber Ducky).

The program itself is administered by a selfbot — this codebase — which impersonates the Doppel mascot's Slack user account. It DMs participants to onboard them (link HCA + Hackatime), tracks progress, and handles submissions entirely through Slack conversation. That's why `src/slack/client.ts` constructs the **primary** `app` client against user-level tokens (`xoxc`/`xoxd`) — the participant-facing "bot" is really a user pretending to be one. A companion real bot user (`xoxb`) is kept around for admin-only tasks that require actual bot capabilities (webhook events, interactivity, signed requests).

## Commands

- `bun run dev` — run the server with `--watch` (no screen clear). Entrypoint is `index.ts`.
- `bun run db:generate` — generate a Drizzle migration from `src/db/schema.ts` into `./drizzle`.
- `bun run db:migrate` — apply migrations against `DATABASE_URL`.
- `bun run db:push` — push schema directly (dev shortcut, bypasses migrations).

There is no test runner, linter, or build script configured. `.prettierrc` exists for formatting only.

## Architecture

Doppelpheus is a Slack bot that walks a user through linking their Hack Club Auth (HCA) and Hackatime accounts, then persists tokens in Postgres. It runs a single Bun process that serves both Slack event webhooks and OAuth callbacks.

### Three Slack "apps" from one process (`src/slack/client.ts`)

The codebase uses [`slack.ts`](https://www.npmjs.com/package/slack.ts) to construct **three** `App` instances against the same workspace, each with a distinct role. Keeping them straight is essential — participant-facing traffic goes through the selfbot (`app`), while `bot` is a real bot user reserved for admin work:

- **`app`** — the **primary participant-facing selfbot**. Uses user-session auth (`xoxc` + `xoxd` cookie) with the **RTM receiver** to listen for DMs to the Doppel mascot user account and drive the onboarding conversation. Also used to open DM channels via `conversations.open`. This is the "selfbot" the program is built on.
- **`bot`** — the **actual bot user** (`xoxb`) using the **fetch receiver** with signing-secret verification. Handles `/slack/events` HTTP webhook traffic (events, interactivity, button actions) and is used for admin-only tasks that require real bot capabilities. Not the primary participant channel.
- **`userBot`** — a user token (`xoxp`) with no receiver, used purely to *send* DMs on behalf of the Doppel user (e.g. delivering the OAuth CTA buttons that Slack requires be sent by a user, not a bot).

`bot.receiver.fetch(req)` is wired into `Bun.serve` at `/slack/events` in `index.ts`. Listeners in `src/slack/bot/listeners.ts` (admin/bot events + button-action handlers) and `src/slack/user/listeners.ts` (participant DM handling on the selfbot) are registered at import time via side-effect imports in `index.ts`.

### Participant (selfbot) side — `src/slack/user/`

- `listeners.ts` registers RTM handlers on `app` for DMs to the Doppel mascot.
- `keywords.ts` holds keyword/intent matching for participant messages — the entry point for adding new triggers in the participant conversation.
- `operations.ts` centralizes side-effectful actions the selfbot performs on behalf of the participant flow (progress updates, submissions, etc.).
- `views/` contains Slack Block Kit view builders rendered back to the participant (e.g. `projects.ts`).

### Admin (real bot) side — `src/slack/bot/`

- `listeners.ts` registers `bot` handlers for events, interactivity, and button actions coming through the `/slack/events` webhook.
- `home.ts` renders the App Home surface for admins (stats, review queues, etc.).
- `modals/` holds Slack modal view builders + submission handlers (`project.ts`, `shop-item.ts`) used for admin review/editing flows.
- `admin-upload.ts` handles files uploaded through the admin bot; uploads are persisted via `src/queries/uploaded-file.ts`.

### Domain queries (`src/queries/`)

Beyond the auth flow, the DB models the whole program:

- `user.ts`, `project.ts` — participants and their submissions.
- `shop-item.ts` — the tiered prizes mentioned in Purpose are modeled as `shop_items`, editable via the admin shop-item modal.
- `uploaded-file.ts` — files uploaded through the admin bot.
- `audit-log.ts` — admin mutations write audit entries; new admin actions that change state should record one too.
- `stats.ts` — aggregate queries surfaced on the admin home tab.
- `config.ts` — dynamic runtime config (feature flags / tunables) stored in the DB rather than env vars.

### OAuth flow

State passed through OAuth is a UUID row in the `auth_attempts` table (`src/queries/auth-attempt.ts`), tied to a Slack user id. On callback:

1. Look up the attempt by state; if `used`, resend the auth message and redirect back to the user's DM.
2. Exchange the code with the provider, mark attempt used, upsert the token into `users` (`hcaToken` / `hackatimeToken`).
3. For HCA specifically: if `identity.ysws_eligible` is false, send the ineligible DM instead of persisting.
4. After HCA success, chain into `sendHackatimeAuthMessage`. After Hackatime success, just redirect to the DM.

Both callbacks end by redirecting to `https://hackclub.enterprise.slack.com/archives/<dm-channel-id>` (see `redirectToDM` in `src/utils.ts`).

### Database

Drizzle ORM against Postgres via `drizzle-orm/node-postgres` (`src/db/index.ts`). Schema in `src/db/schema.ts`; relations declared separately in `src/db/relations.ts` using `defineRelations` and passed to `drizzle()` so the query builder can traverse them (e.g. `getUserWithProjectsById`). When adding a table, update both files.

Migrations live in `./drizzle` and are the source of truth — prefer `db:generate` + `db:migrate` over `db:push` for anything shared.

### Env vars (see `.env.example`)

Required for boot: `DATABASE_URL`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_XOXC_TOKEN`, `SLACK_XOXD_TOKEN`, `SLACK_XOXP_TOKEN`. `src/slack/client.ts` throws if any are missing. Note: `SLACK_XOXD_TOKEN` must be copied from the cookie header **without URL-decoding**. OAuth flows additionally need `HCA_CLIENT_ID/SECRET`, `HACKATIME_CLIENT_ID/SECRET`, and `EXTERNAL_URL` (the publicly reachable base for callbacks). `ADMIN_API_KEY` gates the `POST /api/welcome` admin endpoint via the `x-api-key` header — that endpoint DMs a given user id from the selfbot to kick off / test the participant conversation.

### Slack app manifest

`manifest.json` is the source of truth for scopes and event subscriptions. When adding a listener that needs a new scope or event, update it there and reinstall the app.

### Where to hook new behavior

- **New participant DM behavior** → add a matcher in `src/slack/user/keywords.ts` and wire it in `src/slack/user/listeners.ts`; put side effects in `operations.ts` and any rendered blocks in `views/`.
- **New admin button / modal** → register the action in `src/slack/bot/listeners.ts` and add the view under `src/slack/bot/modals/`. State-changing actions should write to `audit-log`.
- **New DB table** → update both `src/db/schema.ts` and `src/db/relations.ts`, add a query module under `src/queries/`, then `bun run db:generate` + `bun run db:migrate`.
- **New OAuth-style flow** → mirror `src/api/auth/hackclub.ts` (create `auth_attempts` row → callback exchanges code → mark used → upsert token → `redirectToDM`). Add the route in `index.ts`.
- **New Slack scope or event subscription** → update `manifest.json` and reinstall the app.

---

## Bun usage conventions

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

### Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.