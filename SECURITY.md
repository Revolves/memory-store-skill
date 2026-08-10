# Security model

Memory Store is a local, persistent memory skill. Review these boundaries before installation.

## Installation and updates

- `npm i memory-store-skill` only installs the npm package. The package has no `postinstall` lifecycle hook and does not modify Agent configuration directories.
- `memory-store-install` writes the skill only after the user runs it explicitly. Use `--dry-run` to preview targets and `--agent` or `--target` to limit the destination.
- Installation does not create memory data. It writes `~/.memory-store/config.json` only when the user selects a profile interactively or passes `--memory-profile`.
- `memory-store-update` only copies files from the currently installed local package into an existing skill installation. It does not download or execute remote code.
- Production scripts do not invoke shells or child processes. A release contract checks these properties before publishing.

## Persistent data

- Memory data is stored as local JSON under the configured global or workspace store.
- The safe default profile is `explicit`. Automatic recall and storage require an opt-in `balanced` or `proactive` profile; `off` disables both.
- There is no daemon, background transcript scanner, telemetry, or automatic network request.
- `private` is cooperative Agent filtering, not encryption or an operating-system access-control boundary.
- Do not store passwords, API keys, tokens, raw personal data, or other secrets.

## Filesystem writes

The memory CLI writes only to the explicitly selected memory scope. The installer writes only to targets selected by `--agent`, `--target`, `--all`, or an interactive confirmation. Use `--dry-run` or `--check` before making changes when reviewing a new release.

Please report vulnerabilities through the repository's private security-reporting channel when available, rather than a public issue.
