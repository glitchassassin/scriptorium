# Configuration Reference

Scriptorium reads non-sensitive settings from `config.yml` and secrets from `secrets.yml` in its per-user config directory.
CLI flags override environment variables, which override YAML values, which override schema defaults.
The configuration directory can be overridden with `--config-dir <path>` or `SCRIPTORIUM_CONFIG_DIR`.
The data directory can be overridden with `--data-dir <path>` or `SCRIPTORIUM_DATA_DIR`.

| Platform | <scriptorium_config_dir> | <scriptorium_data_dir> |
| --- | --- | --- |
| macOS | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |
| Linux | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |
| Windows | `%XDG_CONFIG_HOME%\scriptorium` or `%USERPROFILE%\.config\scriptorium` | `%XDG_DATA_HOME%\scriptorium` or `%USERPROFILE%\.local\share\scriptorium` |

Examples use `<scriptorium_config_dir>` and `<scriptorium_data_dir>` as shorthand for Scriptorium's per-user config/data directories and `$HOME` for the user's home directory.

## config.yml

```yaml
server:
  host: 0.0.0.0
  port: 5174
workspace:
  browserRoot: $HOME
opencode:
  bin: opencode
network:
  tailscale: false
database:
  path: <scriptorium_data_dir>/app.db
```

| Key | Type | Default | CLI | Env | Description |
| --- | --- | --- | --- | --- | --- |
| `server.host` | string | `0.0.0.0` | `--host` | `SCRIPTORIUM_HOST` | Host interface for the web server. |
| `server.port` | number | `5174` | `--port` | `SCRIPTORIUM_PORT` | Port for the web server. |
| `workspace.browserRoot` | string | `$HOME` | `--browser-root` | `SCRIPTORIUM_BROWSER_ROOT` | Root directory exposed in the workspace browser. |
| `opencode.bin` | string | `opencode` | `--opencode-bin` | `OPENCODE_BIN` | OpenCode executable name or path. |
| `network.tailscale` | boolean | `false` | `--tailscale` |  | Expose the app with tailscale serve. |
| `database.path` | string | `<scriptorium_data_dir>/app.db` | `--db-path` | `SCRIPTORIUM_DB_PATH` | Path to the SQLite database file. |

## secrets.yml

```yaml
auth:
  sessionSecret: <generated on first run or set via env>
```

| Key | Type | Default | CLI | Env | Description |
| --- | --- | --- | --- | --- | --- |
| `auth.sessionSecret` | string |  |  | `SESSION_SECRET` | Session signing secret. |

