# AGENTS

## References

- For any frontend or component design work, follow @docs/e-ink-style-guide.md.
- Significant repositories may be stored in references/ for reference purposes.
- Avoid explanatory text or filler
- Treat Scriptorium as a single-user, multi-device app when making product and architecture decisions.
- Use `npm` for package management and project scripts in this repository; do not switch to `bun`, `pnpm`, or `yarn` unless the user explicitly asks.
- For Playwright MCP testing against the local app, use `http://localhost:5174` unless the user explicitly asks otherwise; that hostname avoids passkey restrictions in local testing.
- When implementing a GitHub issue, always reference the issue number in commit messages.
- When asked to do a refactor, remove legacy code, compatibility shims, and transitional layers by default; only keep them when the user explicitly requests backward compatibility.
- Include comments or doc strings explaining the why behind the code or decision if it is not clear from the code itself. Comments should always explain the current state of the code, not reference prior versions.
