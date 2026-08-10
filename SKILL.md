---
name: memory-store
description: >-
  自动存储、检索和维护跨会话、多 Agent 的结构化记忆。用户提到“之前、上次、记得、历史、当时、为什么选、方案、决策、架构、进度、状态、习惯、约定、偏好、排障、接着上次、任务交接”，或说 remember、recall、history、save memory 时使用；对具体历史、进度、偏好、惯例、排障与技术选型原因的问题，必须先调用 memory_cli search，即使平台已经提供 working memory。用户明确要求记住信息，或当前对话形成可跨会话复用的决策、排障结论、流程、偏好或任务状态时，也使用本 skill 存储。不要仅为无历史依赖的一次性问题执行无差别检索。
---

# Memory Store

使用纯 Node.js CLI 管理全局与工作区两层记忆。由 Agent 判断语义价值，CLI 负责校验、存储、过滤、排序和归档。

## 先判断是否检索

按以下优先级执行：

1. **必须检索**：用户引用过去的讨论、决策、进度、状态、偏好、惯例、排障记录；接手其他 Agent 的任务；用户要求确认“是否记得”。加载适用的仓库与 skill 指令后，把 `search` 作为第一个任务动作，再读取项目文件补充。
2. **按需检索**：新会话与既有工作明显连续、当前上下文缺少决策依据，或任务交接可能存在 shared 记忆。
3. **跳过检索**：问题自包含且与历史无关，例如一次性解释、翻译或计算。不要为了“每轮都搜”而增加延迟和噪声。

平台注入的 working memory 只是当前会话摘要，不能替代具体历史查询。记忆库无命中时，说明无命中，再从代码、文档或用户提供的信息继续调查；不要猜测历史。

## 运行 CLI

从本 skill 目录执行；需要 Node.js 18 或更高版本。

```bash
node scripts/memory_cli.js version
```

命令默认把 JSON 写到 stdout；只有需要落盘时才使用 `--output <file>`。`--stdout` 可显式要求 stdout。

### 检索

从请求提取 2–3 个稳定关键词，并始终带当前 Agent 身份：

```bash
node scripts/memory_cli.js search \
  --query "数据库 选型" --scope all \
  --type decision,debug_solution \
  --as-agent <agent-id> --limit 5 --stdout
```

任务交接优先检索工作区共享记忆：

```bash
node scripts/memory_cli.js search \
  --query "任务主题 进度" --scope workspace \
  --visibility shared,global --as-agent <agent-id> --limit 10 --stdout
```

只把与当前问题直接相关的结果用于回答。若新旧记忆冲突，优先采用时间更晚、明确标记为最终决策且与当前实现一致的记录，并向用户说明冲突或推断。需要完整条目时再 `recall --id <id> --as-agent <agent-id>`；只读环境中直接使用 search 摘要，不调用会更新访问计数的 recall。

### 存储

仅当以下三问都为“是”时存储：

1. 跨会话或交接后仍可能有用吗？
2. 能压缩成清晰的标题与不超过约 200 字的摘要吗？
3. 若不记录，关键信息会丢失吗？

```bash
node scripts/memory_cli.js store \
  --type decision \
  --title "数据库选型" \
  --summary "选择 SQLite；当前为单用户本地场景，无需独立数据库服务。" \
  --tags "database,architecture" \
  --importance 0.85 --priority P1 \
  --scope workspace --visibility shared \
  --agent-id <agent-id> --stdout
```

不要存原始对话全文。单次对话通常不超过 5 条；优先更新既有记忆，避免重复。

## 选择 scope 与 visibility

| 内容 | scope | visibility |
|---|---|---|
| 当前项目的进度、决策、排障、交接 | `workspace` | `shared` |
| 跨项目稳定偏好或通用事实 | `global` | `global` |
| 仅用于当前 Agent 的临时内容 | 与内容一致 | `private` |

`private` 只是基于 `agent-id` 的**协作过滤**，不是加密、操作系统权限或可信安全边界。CLI 不会自动检测或脱敏密钥、凭据、令牌和个人信息；不要把秘密写入记忆库。访问 private 记忆时必须使用同一个 Agent 身份。

## 记录信号

| 信号 | type | 常用 priority |
|---|---|---|
| 选 X 而非 Y，并给出原因 | `decision` | P1 |
| 问题根因与已验证修复 | `debug_solution` | P1 |
| 可重复的操作顺序 | `workflow` | P2 |
| 稳定用户偏好 | `preference` | P2 |
| 项目事实或约束 | `fact` | P2 |
| 可供交接的进度、待办或阻塞 | `state` | P3 |
| 完成、发布等事件 | `event` | P3 |
| 依赖或实体关系 | `relation` | P2 |

用户明确说“记住”时优先记录，但仍要先去除秘密与无复用价值的细节。Agent 负责摘要和分类；`compress` 只提取候选片段，不替代语义判断。

## 多 Agent 规则

- 每次读取和写入都使用稳定的 `--as-agent` / `--agent-id`，或设置 `MEMORY_AGENT_ID`。优先使用宿主提供的 canonical Agent ID；没有时选择一个会话内稳定的 ID 并持续复用。
- 工作区协作成果默认写成 `shared`，包括“做了什么、为何这样做、下一步是什么”。
- 接手任务时先消费相关 shared 记忆，完成阶段后再贡献新的状态或结论。
- 不要尝试绕过其他 Agent 的 private 过滤。

## 按需读取参考资料

- 需要完整命令、参数、输出与归档恢复操作时，读取 [references/cli.md](references/cli.md)。
- 需要维护策略、隐私模型、并发限制、损坏恢复和备份建议时，读取 [references/operations.md](references/operations.md)。
- 需要直接处理数据格式或验证字段时，读取 [references/memory_schema.json](references/memory_schema.json)。

不要手工改写 `memories.json`，除非 CLI 不可用且已经备份；并发环境下尤其不要直接写 JSON。
