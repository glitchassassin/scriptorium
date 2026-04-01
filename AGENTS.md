# AGENTS

## References

- For any frontend or component design work, follow @docs/e-ink-style-guide.md.
- Significant repositories may be stored in references/ for reference purposes.
- Avoid explanatory text or filler
- Treat Scriptorium as a single-user, multi-device app when making product and architecture decisions.
- Use `npm` for package management and project scripts in this repository; do not switch to `bun`, `pnpm`, or `yarn` unless the user explicitly asks.
- For Playwright MCP testing against the local app, use `http://localhost:5174` unless the user explicitly asks otherwise; that hostname avoids passkey restrictions in local testing.
- When implementing a GitHub issue, always reference the issue number in commit messages.
- Treat commit messages that land on `main` as release metadata. Use Conventional Commits for merge and squash commit titles:
- `feat:` for user-visible features that should trigger a minor release
- `fix:` for bug fixes and behavior corrections that should trigger a patch release
- `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer for breaking changes that should trigger a major release
- `docs:`, `test:`, `refactor:`, `chore:`, `build:`, and `ci:` for non-release changes unless the change should ship to users, in which case use `fix:` or `feat:` instead
- Keep GitHub issue references in commit messages after the conventional prefix, for example `feat: add auto-release workflow for #19`
- When asked to do a refactor, remove legacy code, compatibility shims, and transitional layers by default; only keep them when the user explicitly requests backward compatibility.
- Include comments or doc strings explaining the why behind the code or decision if it is not clear from the code itself. Comments should always explain the current state of the code, not reference prior versions.
