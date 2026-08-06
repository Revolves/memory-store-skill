# Workspace Rules for Memory Management

## Automatic Memory Store Integration

1. **Auto-Recall on User Queries**:
   - At the beginning of handling any complex technical user query, search the memory store using `node ~/.claude/skills/memory-store/scripts/memory_cli.js search --query "<key_terms>" --scope all --limit 3 --output scratch/recall_tmp.json`.
   - If relevant memories exist, silently incorporate them into your response context.

2. **Auto-Extract on Decision / Solution / Preference**:
   - Whenever a technical decision, bug fix, workflow rule, or user preference is finalized in the conversation, invoke `memory_cli.js store` to persist it automatically into the memory store.
