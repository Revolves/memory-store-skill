# Workspace Rules for Memory Management

## Automatic Memory Store Integration

1. **Recall When History Matters**:
   - Search first when the user references prior decisions, progress, preferences, debugging history, conventions, or task handoff. Search when an ongoing task lacks historical context; skip recall for self-contained questions with no historical dependency.
   - Use `memory-store search --query "<key_terms>" --scope all --as-agent <agent-id> --limit 3 --stdout` when the package binary is available, or `node scripts/memory_cli.js ... --stdout` from this repository.
   - Do not assume a hard-coded `~/.claude` location. The installer honors `CLAUDE_CONFIG_DIR` and `CODEX_CONFIG_DIR`, and other platforms use their own configuration roots.
   - If relevant memories exist, silently incorporate them into your response context.

2. **Auto-Extract on Decision / Solution / Preference**:
   - Whenever a technical decision, bug fix, workflow rule, or user preference is finalized in the conversation, invoke the same resolved CLI's `store` command to persist it automatically into the memory store.
