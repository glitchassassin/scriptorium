# Scriptorium

Scriptorium is an experimental single-user, multi-device app for browsing local workspaces and running OpenCode-backed coding sessions through a React Router interface.

This repo is intentionally exploratory. Expect rough edges, fast iteration, and incomplete product decisions while the project settles.

## What It Does

- Launches and tracks local coding instances
- Browses workspace files and git state from the app
- Streams session events and message history
- Uses passkey-based authentication for non-`localhost` access

## Requirements

- Node.js 24+
- npm
- `opencode` available on your PATH, or an explicit `OPENCODE_BIN`
- Optional: Tailscale if you want Scriptorium exposed through `tailscale serve`

This repository uses `npm` as its canonical package manager.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

The dev server runs through Scriptorium's unified Node server entrypoint with Vite in middleware mode.

On startup, Scriptorium creates missing config files and generates a session secret when needed. The SQLite database is opened lazily, and pending migrations run when the database is first opened.

To expose the dev server through Tailscale for a run:

```bash
npm run dev -- --tailscale
```

Create a production build:

```bash
npm run build
```

Start the built app:

```bash
npm start
```

`npm start` uses the same server entrypoint as development, but serves the built React Router app instead of Vite middleware.

The published package uses the same entrypoint:

```bash
npx scriptorium
```

Pass runtime flags through `npm start --`:

```bash
npm start -- --host=127.0.0.1 --port=6200 --no-tailscale
```

By default, development and production both run on port `5174`.

For the full generated config reference, see `docs/config.md`.

## Authentication

`localhost` intentionally bypasses passkey authentication for local-only access.

Requests through `127.0.0.1`, LAN IPs, Tailscale hostnames, and forwarded hosts still require passkey authentication.

First-time passkey registration is a two-step flow:

- complete the browser or device passkey prompt
- open `/confirm-passkey` and enter the one-time code printed to the server console

## Configuration

Scriptorium reads runtime settings from:

- CLI flags passed to `npm start -- ...`
- environment variables
- `config.yml` for non-sensitive settings
- `secrets.yml` for secrets such as the session signing secret

Runtime config files live in the config directory. Runtime data such as the SQLite database live in the data directory.

Use `--config-dir <path>` / `SCRIPTORIUM_CONFIG_DIR` to override config location.
Use `--data-dir <path>` / `SCRIPTORIUM_DATA_DIR` to override runtime data location.

Default per-platform directories:

| Platform | Default config dir | Default data dir |
| --- | --- | --- |
| macOS | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |
| Linux | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |
| Windows | `%XDG_CONFIG_HOME%\\scriptorium` or `%USERPROFILE%\\.config\\scriptorium` | `%XDG_DATA_HOME%\\scriptorium` or `%USERPROFILE%\\.local\\share\\scriptorium` |

Precedence is: CLI flags -> environment variables -> YAML values -> schema defaults.

Common flags and env vars include:

- `--host` / `SCRIPTORIUM_HOST`
- `--port` / `SCRIPTORIUM_PORT`
- `--browser-root` / `SCRIPTORIUM_BROWSER_ROOT`
- `--db-path` / `SCRIPTORIUM_DB_PATH`
- `--opencode-bin` / `OPENCODE_BIN`
- `--opencode-url` / `SCRIPTORIUM_OPENCODE_URL`
- `--tailscale` / `--no-tailscale`
- `SESSION_SECRET` to override the generated session secret

`workspace.browserRoot` controls both the root shown in the workspace browser and the working directory used when Scriptorium launches its shared `opencode serve` process.

Example:

```bash
SCRIPTORIUM_HOST=127.0.0.1 \
SCRIPTORIUM_PORT=6200 \
SCRIPTORIUM_BROWSER_ROOT=$HOME/src \
SCRIPTORIUM_OPENCODE_URL=http://127.0.0.1:44556 \
OPENCODE_BIN=opencode \
npm start -- --no-tailscale
```

Use `localhost` rather than `127.0.0.1` only when you explicitly want the intentional no-auth local bypass.

## Tailscale On Launch

The unified server optionally runs `tailscale serve` when `network.tailscale: true` is set in config or `--tailscale` is passed.

Use `--no-tailscale` to force local-only startup for a run.

If Tailscale is enabled and installed/authenticated, that makes the app reachable through your Tailnet. If Tailscale is missing or unavailable, startup continues normally and the app stays local-only.

On shutdown, the script also tries to turn the Tailscale serve configuration back off.

## Offline Behavior

Scriptorium registers a service worker in development and production.

Static assets are cached, and offline navigations fall back to a minimal offline page. Live workspace data and session activity still require a network connection.

## Notes

- The app is designed around a personal/local workflow, not a multi-tenant hosted service
- Runtime config and secrets live in the per-user Scriptorium config directory, documented in `docs/config.md`
- This repository does not include Docker configuration
