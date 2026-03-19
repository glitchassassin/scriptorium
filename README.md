# Scriptorium

Scriptorium is an experimental single-user, multi-device app for browsing local workspaces and running OpenCode-backed coding sessions through a React Router interface.

This repo is intentionally exploratory. Expect rough edges, fast iteration, and incomplete product decisions while the project settles.

## What It Does

- Launches and tracks local coding instances
- Browses workspace files and git state from the app
- Streams session events and message history
- Uses passkey-based authentication for local access

## Requirements

- Node.js 20+
- npm
- `opencode` available on your PATH, or an explicit `OPENCODE_BIN`
- Optional: Tailscale if you want `npm start` to expose the app through `tailscale serve`

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Start the built app:

```bash
npm start
```

Pass runtime flags through `npm start --`:

```bash
npm start -- --host=127.0.0.1 --port=6200 --no-tailscale
```

By default, development and production both run on port `5174`.

For the full generated config reference, see `docs/config.md`.

## Configuration

Scriptorium reads runtime settings from:

- CLI flags passed to `npm start -- ...`
- environment variables
- `config.yml` for non-sensitive settings
- `secrets.yml` for secrets such as the session signing secret

Precedence is: CLI flags -> environment variables -> YAML values -> schema defaults.

Common flags and env vars include:

- `--host` / `HOST`
- `--port` / `PORT`
- `--browser-root` / `SCRIPTORIUM_BROWSER_ROOT`
- `--db-path` / `SCRIPTORIUM_DB_PATH`
- `--opencode-bin` / `OPENCODE_BIN`
- `--tailscale` / `--no-tailscale`
- `SESSION_SECRET` to override the generated session secret

Example:

```bash
HOST=127.0.0.1 \
PORT=6200 \
SCRIPTORIUM_BROWSER_ROOT=$HOME/src \
OPENCODE_BIN=opencode \
npm start -- --no-tailscale
```

## Tailscale On Launch

The production start command runs `node ./scripts/start-with-tailscale.ts`, which starts the built React Router server and optionally runs `tailscale serve` when `tailscale: true` is set in config or `--tailscale` is passed.

Use `--no-tailscale` to force local-only startup for a run.

If Tailscale is enabled and installed/authenticated, that makes the app reachable through your Tailnet. If Tailscale is missing or unavailable, startup continues normally and the app stays local-only.

On shutdown, the script also tries to turn the Tailscale serve configuration back off.

## Notes

- The app is designed around a personal/local workflow, not a multi-tenant hosted service
- Runtime config and secrets live in the per-user Scriptorium data directory, documented in `docs/config.md`
- This repository does not include Docker configuration
