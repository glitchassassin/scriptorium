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

By default, development runs on `http://localhost:5173`.

## Environment Variables

Scriptorium works with sensible local defaults, but these variables control the main runtime behavior:

- `SESSION_SECRET`: signing secret for the auth cookie; set this in any stable environment so sessions survive restarts
- `SCRIPTORIUM_DB_PATH`: path to the SQLite database file; defaults to `.data/app.db`
- `SCRIPTORIUM_BROWSER_ROOT`: root directory exposed in the file browser and new-instance picker; defaults to your home directory
- `OPENCODE_BIN`: path or command name for the OpenCode executable; defaults to `opencode`
- `PORT`: port used by `npm start`; defaults to `5174`
- `HOST`: host binding used by `npm start`; defaults to `0.0.0.0`

Example:

```bash
SESSION_SECRET=replace-me \
SCRIPTORIUM_DB_PATH=.data/app.db \
SCRIPTORIUM_BROWSER_ROOT=$HOME \
OPENCODE_BIN=opencode \
npm run dev
```

## Tailscale On Launch

The production start command runs `node ./scripts/start-with-tailscale.ts`, which does two things:

1. Starts the built React Router server
2. Tries to run `tailscale serve --bg http://localhost:$PORT`

If Tailscale is installed and authenticated, that makes the app reachable through your Tailnet. If Tailscale is missing or unavailable, startup continues normally and the app stays local-only.

On shutdown, the script also tries to turn the Tailscale serve configuration back off.

## Notes

- The app is designed around a personal/local workflow, not a multi-tenant hosted service
- The database directory `.data/` is intentionally gitignored
- This repository does not include Docker configuration
