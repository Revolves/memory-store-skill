[![中文](https://img.shields.io/badge/🇨🇳-中文-blue)](README.zh.md) [![English](https://img.shields.io/badge/🇬🇧-English-green)](README.en.md)

# Memory Store Skill

**Automated conversation memory storage, sharing & retrieval for multi-agent AI workflows**

> A skill for AI workflows: the agent auto-triggers storage during conversation, then recalls & injects relevant memories in new sessions or handoffs — closing the shared-memory loop for "same work content, across sessions and agents".

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Installation](#4-installation)
5. [Quick Start (5 minutes)](#5-quick-start-5-minutes)
6. [Usage](#6-usage)
7. [Project Structure](#7-project-structure)
8. [FAQ](FAQ.md) — Quick answers

---

## 1. Introduction

Memory Store is a **lightweight conversation memory skill** for AI agent workflows. It solves three problems:

1. **Cross-session amnesia**: key decisions, debugging solutions and preferences are lost when context ends → stored structurally, recalled automatically next time.
2. **No sharing between agents**: multiple agent sessions working on the same content don't know each other's progress → `shared` visibility enables seamless handoff.
3. **Memory bloat**: memories accumulate, retrieval slows, signal-to-noise drops → decay mechanism + archiving keeps the store lean and fresh.

The design holds the **Skill baseline**: `SKILL.md` is the instruction core, the CLI is a lightweight support tool (pure Node.js built-ins, zero dependencies). No standalone system, no daemon. Semantic judgment (what to remember, how to compress, when to recall) belongs to the agent's LLM; the CLI only does deterministic storage and retrieval.

---

## 2. Features

| Feature | Description |
|---------|-------------|
| Two layers | `global` (shared across projects) + `workspace` (collaboration within a task) |
| Three-tier visibility | `private` (owner only) / `shared` (collaborators) / `global` (all agents) |
| 8 memory types | fact / decision / preference / workflow / debug_solution / state / event / relation |
| Agent-driven triggering | The agent decides in-conversation: store on signal, search on history reference |
| Auto compression | Agent summarizes raw text into concise memories with LLM; raw text is never stored |
| Lifecycle | Decay scoring + archive (TTL/decay/importance triple criteria) + merge dedup |
| Chinese retrieval | Built-in n-gram windows: whole-sentence Chinese queries hit without tokenization |
| Atomic writes | Temp file + `os.replace`; concurrent agent writes never corrupt data |
| Multi-platform | Claude Code / Codex / Gemini CLI / OpenCode / WorkBuddy / Cursor / Windsurf / QoderWorkCN / Trae CN |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Agent Collaboration Layer (multi-agent / multi-session) │
└───────────────┬─────────────────────────────────────┘
                │ Agent decides in conversation (LLM semantic judgment)
┌───────────────▼─────────────────────────────────────┐
│  Workspace Scope                                    │
│  {workspace}/.agents/memory-store/    default shared │
│  └ Current project/task context, progress, decisions │
└───────────────┬─────────────────────────────────────┘
                │ Promote / inject
┌───────────────▼─────────────────────────────────────┐
│  Global Scope                                       │
│  ~/.memory-store/                     default global │
│  └ User preferences, common knowledge, cross-project │
└─────────────────────────────────────────────────────┘
```

- **Storage format**: JSON files (agents can read/write directly, easy to backup & migrate)
- **Concurrency**: atomic writes (tmp + `os.replace`); no locks, no event bus, no daemon
- **Division of labor**: CLI does deterministic work (parse/dedup/persist/index/score); the agent does semantic work (identify/compress/classify/trigger)

---

## 4. Installation

### Option 1: local script install (recommended)

```bash
# Clone the repo
git clone https://github.com/Revolves/memory-store-skill.git
cd memory-store-skill

# Auto-detect and install to all detected AI agents
node scripts/install.js --all

# Install to a specific agent
node scripts/install.js --agent claude

# List detected agents
node scripts/install.js --list
```

> npm package coming soon. Once published: `npm install -g memory-store-skill`.

### Option 2: manual copy

```bash
cp -r memory-store ~/.claude/skills/        # Claude Code
cp -r memory-store ~/.workbuddy/skills/     # WorkBuddy
cp -r memory-store .agents/skills/          # Project level
```

Restart the session after installation. Script paths are relative to the skill dir: `node scripts/memory_cli.js` (pure Node built-ins, no third-party deps).

---

## 5. Quick Start (5 minutes)

> New to Memory Store? This section covers the minimal flow. Full details in the sections below.

### Step 1: Store a memory

```bash
node scripts/memory_cli.js store \
  --type fact \
  --title "Project tech stack" \
  --summary "Frontend React, backend Node.js, database SQLite" \
  --tags "tech-stack,project" \
  --importance 0.7 \
  --scope global
```

### Step 2: Search memories

```bash
node scripts/memory_cli.js search \
  --query "tech stack" \
  --scope all \
  --limit 5 \
  --output result.json
```

### Step 3: View results

```bash
cat result.json    # View the search results
```

> ✅ **Done!** You've completed the basic store → search → view flow. Next:
> - Explore all commands in [Usage](#6-usage)
> - Read the core rules in [SKILL.md](SKILL.md)
> - Check [FAQ.md](FAQ.md) when stuck

---

## 6. Usage

### 5.1 CLI Commands

| Command | Purpose | Key options |
|---------|---------|-------------|
| `init` | Initialize store | `--scope global|workspace` |
| `store` | Store a memory | `--type/--title/--summary/--tags/--importance/--priority/--visibility/--scope/--agent-id/--ttl-days` |
| `search` | Search memories (cross-layer / visibility) | `--query/--scope all/--visibility/--as-agent/--limit` |
| `recall` | Fetch detail by ID (+1 access count) | `--id` |
| `list` | List memories (filter / sort) | `--scope/--type/--tags/--status/--visibility/--sort-by` |
| `update` | Update a memory (visibility upgrade) | `--id/--visibility/--priority/--importance` |
| `delete` | Delete a memory | `--id` |
| `merge` | Merge similar memories | `--ids` |
| `archive` | Archive stale / low-value memories | `--apply-decay/--min-decay/--before-days` |
| `stats` | Statistics (layer/visibility/type) | `--scope all` |
| `compress` | Extract candidate fragments from transcript | `--input` |

### 5.2 Quick Examples

```bash
# Store a decision memory (workspace collaboration)
node scripts/memory_cli.js store \
  --type decision --title "DB choice" \
  --summary "Chose SQLite over PostgreSQL (single-user)" \
  --tags "database,architecture" --importance 0.85 --priority P1 \
  --scope workspace --visibility shared --agent-id agent-a

# New session: search related memories
node scripts/memory_cli.js search \
  --query "database choice" --scope all --as-agent agent-b --limit 5 --output r.json

# Handoff: pull prior agent's shared memories
node scripts/memory_cli.js search \
  --query "work topic" --scope workspace --visibility shared,global --limit 10

# Routine maintenance: archive (run for each scope separately)
node scripts/memory_cli.js archive --scope global --apply-decay --min-decay 0.15 --output a.json
node scripts/memory_cli.js archive --scope workspace --apply-decay --min-decay 0.15 --output b.json
```

### 5.3 Agent Calling View

The skill is designed for **agent-driven usage**: the agent decides in-conversation when to call the CLI.

- **On-demand record**: when the agent identifies valuable information (decision/debug/preference/fact/state...), it compresses the content with LLM and calls `store`.
- **On-demand recall**: on new conversations, topic continuation, handoff, or history references, the agent calls `search` to retrieve relevant memories and inject them into context.

---

## 6. Project Structure

```
memory-store/
├── CHEATSHEET.md                  # CLI quick reference (one-pager)
├── SKILL.md                      # Skill instruction core (triggers + agent behavior rules)
├── README.md / README.en.md      # This document (English)
├── FAQ.md                        # Frequently asked questions
├── scripts/
│   ├── memory_cli.js             # Core CLI (11 commands, pure Node built-ins)
│   └── install.js                # Auto-installer (detect agents + install)
├── references/
│   └── memory_schema.json        # Data contract (JSON Schema)
├── examples/
│   └── example_memories.json     # Example memories (incl. shared/private collaboration)
├── package.json                  # npm package configuration
```

---

## License

MIT License.