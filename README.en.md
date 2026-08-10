# Memory Store Skill

[中文](README.zh.md)

**Structured memory for multi-session, multi-agent workflows.**

The agent identifies durable decisions, fixes, preferences, workflows, and state. A zero-dependency Node.js CLI validates, stores, retrieves, archives, and restores them. There is no daemon and no background transcript scanner.

## Installation

Node.js 18 or newer is required. The current release is available on npm:

```bash
npm i memory-store-skill
```

The npm installer automatically detects supported Agent platforms and copies the skill into place. Start a new Agent session after installation so the platform can discover it.

Verify the installation:

```bash
npx memory-store version
```

To inspect platform identifiers or select one manually:

```bash
npx memory-store-install --list
npx memory-store-install --agent codex
```

Other identifiers include `claude`, `gemini`, `opencode`, `workbuddy`, `cursor`, `windsurf`, `qoderworkcn`, and `trae-cn`.

## Update

```bash
npx memory-store-update
```

The updater downloads `memory-store-skill@latest` from npm, updates only existing skill installations, verifies the copied files, and leaves memory data unchanged. It does not turn an uninstalled platform into a new installation.

```bash
# Preview without writing
npx memory-store-update --dry-run

# Update one platform
npx memory-store-update --agent codex

# Update a custom installation directory
npx memory-store-update --target /path/to/memory-store
```

Start a new Agent session after updating. Source users can run `node scripts/install.js --update` in the repository to refresh existing installations from the current source.

### Install from source

Use the source route for development, source inspection, or unreleased changes:

```bash
git clone https://github.com/Revolves/memory-store-skill.git
cd memory-store-skill
node scripts/install.js --all
```

## Core model

| Dimension | Value | Intended use |
|---|---|---|
| scope | `global` | stable cross-project preferences and knowledge |
| scope | `workspace` | project decisions, progress, fixes, and handoffs |
| visibility | `global` | cross-project cooperative visibility |
| visibility | `shared` | workspace cooperative visibility |
| visibility | `private` | returned by the CLI only to the matching `owner_agent` |

> `private` is an agent-identity cooperation filter, not encryption. The JSON files are plaintext and remain readable to users or processes with filesystem access. The CLI does not detect or redact credentials, tokens, keys, or personal information. Do not store secrets.

Eight memory types are supported: `fact`, `decision`, `preference`, `workflow`, `debug_solution`, `state`, `event`, and `relation`.

## Five-minute quick start

The examples below use the npm CLI and do not require entering the installed skill directory.

### 1. Confirm the version

```bash
npx memory-store version
```

The command prints the installed version; see `package.json` for the source version in this repository.

### 2. Store a workspace decision

```bash
npx memory-store store \
  --type decision \
  --title "Database choice" \
  --summary "Use SQLite for the current local single-user deployment." \
  --tags "database,architecture" \
  --importance 0.85 --priority P1 \
  --scope workspace --visibility shared \
  --agent-id agent-a --stdout
```

### 3. Search

```bash
npx memory-store search \
  --query "database choice" --scope all \
  --type decision,debug_solution \
  --as-agent agent-a --limit 5 --stdout
```

JSON is written to stdout by default; `--stdout` is only the explicit form. Use `--output result.json` when a file is useful.

### 4. Hand off to another agent

```bash
npx memory-store search \
  --query "task topic progress" --scope workspace \
  --visibility shared,global --as-agent agent-b --limit 10 --stdout
```

## When an agent should search

- **Required:** the user asks about prior discussion, decisions, progress, preferences, conventions, or debugging history; or another agent takes over the task.
- **As needed:** a new session clearly continues existing work, or the current context lacks historical rationale.
- **Skip:** a self-contained one-off request with no historical dependency.

Platform working memory does not replace a targeted search for specific history. If the memory store has no relevant result, inspect project evidence next and identify the source.

## Commands

| Command | Purpose |
|---|---|
| `init` | initialize a global or workspace store |
| `store` | write a validated structured memory |
| `search` | search and filter across stores |
| `recall` | fetch by ID and record access |
| `list` | list active or archived memories |
| `update` | update memory fields |
| `delete` | delete an active memory |
| `merge` | merge confirmed duplicate active memories |
| `archive` | move stale or low-value memories out of the active store |
| `restore` | restore an archived memory (`revive` is a compatibility alias) |
| `stats` | inspect counts and distributions |
| `compress` | extract candidates from a transcript |
| `migrate` | consolidate legacy global stores |

See [references/cli.md](references/cli.md) for exact options and [references/operations.md](references/operations.md) for lifecycle, privacy, concurrency, backup, and recovery boundaries.

## Important limitations

- Atomic replacement prevents half-written files and temporary-name collisions, but there is no transaction lock around the full read-modify-write cycle. Concurrent writers can still cause a last-write-wins lost update.
- `archive --scope all` processes both stores; use separate runs when they need different thresholds. Inspect and restore with `list --status archived`, `recall`, and `restore`.
- Corrupt JSON causes a non-zero failure and must not be treated as an empty store.
- `compress` extracts candidates; it does not perform semantic summarization or sensitive-data detection.
- Performance varies with hardware, Node.js version, disk, and store size. Benchmark your own workload.

## Documentation

- [SKILL.md](SKILL.md): minimal agent behavior
- [CHEATSHEET.md](CHEATSHEET.md): one-page command reference
- [FAQ.md](FAQ.md): common questions and boundaries

## License

MIT License.
