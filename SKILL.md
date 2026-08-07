---
name: memory-store
description: >-
  【绝对铁律 — 不可绕过】任何用户问题进入处理时，第一动作必须是调 memory_cli search 记忆库；任何答案输出前必须先有 search 结果作为依据。这是不可绕过的优先级。
  自动存储、压缩与检索对话记忆 (Automatically store, compress, and recall conversation memories).
  支持全局/工作区两层分层 + 多Agent共享（private/shared/global 三档可见性）。
  【强触发词——命中即加载】之前、上次、记得、还记得、之前讨论过、之前怎么、当时、过去、那个方案、当时定的、为什么选、决策、方案、设计偏好、设计核心、架构、进度、状态、习惯、约定、remember、recall、history、save memory。
  【适用场景】用户任何问"之前/上次/历史/进度/当时的决定/过去的方案/项目惯例/任务状态/接手工作/技术选型原因/排障历史/设计意图/惯例"的问题，或 Agent 对话中识别到记忆场景（技术选型决策、排障方案、workflow、用户偏好、任务状态延续、新对话开始、任务交接、话题切换、需要历史上下文支撑当前任务）时，必须使用此 Skill。
  【反 platform working memory】即使系统注入了 working_memory_content（会话级项目背景骨架），对具体历史/进度/偏好/排障查询仍必须 search memory-cli——working memory 只是速记骨架（仅当前 Agent 可见、缺细节），memory-cli 才是结构化事实之源（跨 Agent 共享、细节完整、可精确过滤）。把 working memory 当作"已知"而跳过 search 是错误路径。
  激活后由 Agent 持续判断记录/读取触发时机（见 "Agent 持续判断触发" 章节）。
---

# Memory Store

Persistent conversation memory that survives across sessions and agents.
Extracts, compresses, and indexes reusable knowledge from conversations so the
agent can recall relevant context in future interactions — including work done
by *other agents* on the same task.

## 快速导航
github: https://github.com/Revolves/memory-store-skill

| 读者 | 必读章节 | 参考章节 |
|------|---------|---------|
| 🆕 **新手入门** | [Overview](#overview)、[Two-Layer Model & Visibility](#two-layer-model--visibility)、[Common Mistakes](#common-mistakes) | [CLI Quick Reference](#cli-quick-reference)、[边界条件](#边界条件edge-cases) |
| 🤖 **Agent 行为** | [Agent 持续判断触发](#agent-持续判断触发触发权在-agent)、[对话内按需记录 / 按需读取](#对话内按需记录--按需读取操作手册) | [Auto-Extract Signals](#auto-extract-signals)、[Auto-Recall & Injection](#auto-recall--injection) |
| 👥 **多 Agent 协作** | [Multi-Agent Collaboration Rules](#multi-agent-collaboration-rules) | [无 CLI 环境的降级路径](#无-cli-环境的降级路径可选agent-直读-json) |
| 🔧 **维护管理** | [Maintenance](#maintenance) | [边界条件](#边界条件edge-cases)、[Common Mistakes](#common-mistakes) |

> 提示：新手从 [Overview](#overview) 开始，了解核心概念后再深入各章节。遇到问题先查 [FAQ.md](FAQ.md) 或 [CHEATSHEET.md](CHEATSHEET.md)。

## Overview

This skill provides a lightweight CLI + agent-driven rules. The agent:

1. **Stores** structured memories during conversation (auto-extract on signals)
2. **Shares** work-content memories with collaborating agents (`shared` visibility)
3. **Recalls** relevant memories at the start of new conversations
4. **Maintains** the memory store (archive stale entries with decay)

## Supported Platforms

| Platform | Keyword | Skill Path | Global Memory Store |
|----------|---------|------------|-------------------|
| Claude Code | `claude` | `~/.claude/skills/memory-store/` | `~/.memory-store/` |
| Codex | `codex` | `~/.agents/skills/memory-store/` | `~/.memory-store/` |
| Gemini CLI | `gemini` | `~/.gemini/skills/memory-store/` | `~/.memory-store/` |
| OpenCode | `opencode` | `~/.config/opencode/skills/memory-store/` | `~/.memory-store/` |
| WorkBuddy / Antigravity | `workbuddy` | `~/.workbuddy/skills/memory-store/` | `~/.memory-store/` |
| Cursor | `cursor` | `~/.cursor/skills/memory-store/` | `~/.memory-store/` |
| Windsurf | `windsurf` | `~/.windsurf/skills/memory-store/` | `~/.memory-store/` |
| QoderWorkCN | `qoderworkcn` | `~/.qoderworkcn/skills/memory-store/` | `~/.memory-store/` |
| Trae CN | `trae-cn` | `~/.trae-cn/skills/memory-store/` | `~/.memory-store/` |

> All platforms share the same global memory store at `~/.memory-store/` — memories stored by one agent are visible to all others.

> [!NOTE]
> **脚本路径**：所有 `scripts/` 路径均相对于本 skill 目录（`~/.claude/skills/memory-store/`）。调用 CLI 用 `node scripts/memory_cli.js`（纯 stdlib，无 uv 依赖）。

## Two-Layer Model & Visibility

```
全局记忆 (global scope)    ~/.memory-store/                   跨平台跨项目共享，所有 Agent 可见
工作区记忆 (workspace scope)  {workspace}/.agents/memory-store/  当前项目/任务，协作 Agent 共享
```

每条记忆带 `visibility` 三档（**这是多 Agent 共享的开关**）：

| visibility | 含义 | 谁可读 | 默认用于 |
|------------|------|--------|----------|
| `global` | 全局共享 | 所有 Agent（跨项目） | 全局库记忆、通用知识、用户偏好 |
| `shared` | 工作内容共享 | 同工作区/同任务的协作 Agent | **工作区记忆默认** |
| `private` | 仅自己 | 只有写入的 Agent 自己 | 内部思考、临时草稿、敏感信息 |

> [!IMPORTANT]
> **共享规则（必须遵守）**：
> - 工作区记忆默认 `shared`——同一工作内容的其他 Agent 会话能读到，这是协作基础。
> - 涉及用户隐私、临时内部思考、密钥凭据 → 存 `private`。
> - 通用知识、用户长期偏好 → 存 `global` 库（scope=global）。
> - 检索时 `--as-agent <你的ID>` 会自动过滤别人的 private 记忆，只读共享内容。

## CLI Quick Reference

> 全部命令保持 v1 兼容；新参数均为可选。用 `node scripts/memory_cli.js` 执行。

### store — 存储一条记忆

```bash
node scripts/memory_cli.js store \
  --type decision \
  --title "数据库选型" \
  --summary "选择 SQLite 而非 PostgreSQL，单用户场景" \
  --tags "database,architecture" \
  --importance 0.85 \
  [--scope global|workspace] \
  [--visibility private|shared|global] \
  [--priority P1|P2|P3] \
  [--ttl-days N] \
  [--agent-id <your-id>] \
  [--source-conv-id <conv-id>]
```

默认行为：`--scope global` → 全局库、visibility=global；`--scope workspace` → 工作区库、visibility=shared。
`--priority` 缺省时按 importance 推断（≥0.8→P1，≥0.5→P2，否则 P3）。

### search — 检索记忆（含可见性过滤）

```bash
node scripts/memory_cli.js search \
  --query "关键词" \
  [--scope all|global|workspace] \
  [--type decision,debug_solution] \   # 逗号分隔多值；非法 type 报错
  [--visibility private,shared,global] \
  [--as-agent <your-id>] \
  [--limit 5] \
  [--output results.json | --stdout]
```

- `--scope all`（默认）：合并全局+工作区两层检索。
- `--type`：**支持逗号分隔多值**（如 `decision,debug_solution`），按类型集合过滤；传入非法 type 会报错退出。
- `--output <file>`：写入文件；**缺省即直接 stdout 输出 JSON**（Agent 无需再读文件）。`--stdout` 为显式 stdout 标志。
- `--as-agent <id>`：以该 Agent 身份过滤——别人的 `private` 记忆不可见。
- 跨层结果自动去重，按相关性打分排序（关键词+标签+类型+时间+重要性）。

### recall — 取完整记忆（增加访问计数）

```bash
node scripts/memory_cli.js recall --id mem_xxx --output detail.json
```

### list — 列出记忆（支持过滤）

```bash
node scripts/memory_cli.js list --scope all [--status active] [--visibility shared] [--type decision,debug_solution] [--output list.json | --stdout]
```

`--type` 同样支持逗号分隔多值。

### update — 更新记忆（可升级可见性）

```bash
node scripts/memory_cli.js update --id mem_xxx [--visibility shared] [--priority P1] [--importance 0.9]
```

### archive — 归档过期记忆（衰减判据）

```bash
node scripts/memory_cli.js archive --scope global --apply-decay --min-decay 0.15 --output archived.json
```

TTL 过期 / 衰减分 < 0.15 / 60 天未访问且低访问 → 移入 `archive/archived_YYYYMM.json`。

### stats — 统计

```bash
node scripts/memory_cli.js stats --scope all --output stats.json   # 含 scope/visibility/status 分布
```

### 其他

- `init` — 初始化存储目录（`--scope global|workspace`）
- `version` / `-v` / `--version` — 打印已安装的 skill 版本（`package.json` 中的 `version`，纯 Node 实现）
- `merge` — 合并相似记忆
- `delete` — 删除记忆
- `compress` — 从 transcript 提取候选片段（Agent 总结后 store）。**支持 Antigravity transcript 格式**（`type: USER_INPUT` / `PLANNER_RESPONSE`）**与通用对话格式**（`{role: user|assistant|system, content|text}`），自动识别并输出 `detected_format`；整文件 JSON 数组也兼容。其他平台或自定义格式的 transcript 建议直接用 `store` 手动存储（Agent 自行总结）。

## Agent 持续判断触发（触发权在 Agent）

> [!IMPORTANT]
> **本 skill 的触发设计核心：触发权交给 Agent。** 触发词（"记住"、"recall"等）只是**辅助激活信号**，不是触发条件。本 skill 激活后，你在对话**全过程中保持记忆意识（memory-aware）**，由你自主判断何时记录、何时读取——Agent 是语义大脑，触发时机由 Agent 判断，不由词表决定。没有自动扫描脚本、没有后台进程，CLI 只做确定性的存储与检索。

### 记录触发判断（何时主动 store）

出现以下任一情形，且通过"记忆价值三问"，**立即调用 `store`**（不要等对话结束）：

| 触发情形 | 示例 |
|----------|------|
| 用户显式要求 | "记住：部署先跑 lint" |
| 决策/排障/偏好/事实/状态等信号 | "选 X 而非 Y 因为…"、"问题是…修复是…" |
| 隐含保留意愿 | "以后都这样"、"下次注意"、"别忘了" |
| 任务节点 | 完成子任务、解决 bug、方案确定，值得复用 |

**记忆价值三问（全为"是"才存，否则不存）**：
1. **未来会用上吗**？——跨会话/跨任务可复用，而非一次性琐碎细节。
2. **足够精炼吗**？——能压缩成 ≤200 字的一句话（存总结不存原文）。
3. **不记会丢吗**？——对话结束即消失、无其他记录来源。

### 读取触发判断（何时主动 search — **强约束**）

> [!IMPORTANT]
> **凡用户问题涉及历史/进度/之前/记得/上次，必须先调 `search` 记忆库，再考虑是否读其他文件。**
> 这是本 skill 的"统一入口"——避免 Agent 直接去读项目 `.workbuddy/memory/` 日志或代码文件来推断历史进度（那是开发者/Agent 的工作日志，不是回答用户问题的来源；且容易读到未沉淀为记忆的临时草稿）。
>
> **【关键认知】平台 working memory ≠ memory-cli 记忆库**：你启动会话时平台注入的 `working_memory_content` 是**会话级项目背景概览**（仅你当前会话可见，且只是骨架）。而 `memory-cli.js search` 检索的是**结构化跨 Agent 共享记忆库**（其他 Agent 也能访问，且是经过摘要、分类、打分的高质量记录）。
> **即使 working memory 已有项目概览，对"具体的"历史决策/进度/偏好/排障/惯例查询，仍必须 search memory-cli**——因为：(1) working memory 只是骨架，缺细节；(2) 其他 Agent 看不到 working memory，必须通过 memory-cli 共享；(3) 记忆库有结构化字段（scope/visibility/decay_score），能做精确过滤。
> **不要把 working memory 当作"已知"——它只是平台给你的速记，记忆库才是事实之源。**

**用户问题类型 → 强制入口清单**（命中即先 `search`，再回答）：

| 用户说法（示例） | 问题类型 | 强制动作 |
|------------------|----------|----------|
| "之前的进度"、"实施到哪了"、"我们之前定的…" | 历史进度 | `search --scope all --limit 5` |
| "之前怎么解决的"、"为什么选 X"、"上次的方案" | 历史决策/排障 | `search --type decision,debug_solution`（逗号分隔多值，一次覆盖） |
| "用户偏好"、"项目惯例"、"我们怎么约定的" | 偏好/工作流 | `search --scope all --type preference,workflow`（多值一次覆盖） |
| "任务进展"、"当前状态"、"接着上次的" | 状态/任务交接 | `search --type state` + `--visibility shared,global` |
| "记得"、"还记得"、"上次讨论过" | 引用历史 | `search --scope all` |
| 新对话/新任务第一句 | 上下文注入 | `search --scope all --limit 5` |

**反模式（禁止）**：
- ❌ 读项目里的 `memory-store-skill/.workbuddy/memory/*.md` 来回答用户——这是开发者工作日志，不是用户问题的数据源
- ❌ 读源码文件推断"实施完成了什么"——记忆库里已有结构化摘要，应当先取记忆
- ❌ 用户问历史时凭"可能做过"猜测——必须 `search` 验证

**搜索无命中时**：再考虑读项目文件补充，但仍应在回答中说明"记忆库未找到，从项目文件补充"——让用户知道信息源头。

出现以下任一情形，主动调用 `search` 并注入相关记忆：

| 触发情形 | 说明 |
|----------|------|
| 新对话/新任务开始 | 开局检索，带上历史上下文 |
| 话题延续 | 当前讨论与历史主题相关（"接着说…"、"上次那个…"） |
| 任务交接 | 接手他人工作，拉取前序 Agent 的 shared 记忆 |
| 用户引用历史 | "之前我们…"、"还记得…" |
| 信息缺口 | 当前上下文不足，需要历史决策/排障方案佐证 |

## 对话内按需记录 / 按需读取（操作手册）

### 按需记录（对话中实时触发）

**在对话过程中持续评估**，命中信号（见下方信号表）时**立即调用 `store`**，不要等对话结束：

```bash
# 命中"决策"信号时，立即：
node scripts/memory_cli.js store \
  --type decision \
  --title "用户中心存储选型" \
  --summary "选择 MySQL 而非 SQLite，因为需要事务支持（Agent 用 LLM 压缩）" \
  --tags "database,architecture" \
  --importance 0.85 \
  --scope workspace --visibility shared --agent-id <your-id>
```

记录时的 4 步判断（Agent 负责）：
1. **识别信号**：对照信号表判断这条信息是否值得记（决策/排障/偏好/事实/状态…）。
2. **压缩**：用你的能力把原话提炼成精炼 `title`（<50 字）+ `summary`（<200 字），不存原文。
3. **定层与可见性**：工作区协作内容 → `--scope workspace --visibility shared`；通用知识/用户长期偏好 → `--scope global`；隐私/临时内部思考 → `--visibility private`。
4. **限量**：单次对话存储上限 5 条，宁缺毋滥——未来用不上的不记。

### 按需读取（对话中适时触发）

**在以下时机主动调用 `search`**，把相关记忆注入当前上下文：

| 时机 | 操作 |
|------|------|
| 新对话开始 | `search --query "关键词" --scope all --as-agent <your-id> --limit 5` |
| 用户引用历史（"之前我们…"） | 按提及主题定向 `search`，命中则 `recall --id` 取详情 |
| 接手他人工作（同工作内容换 Agent） | `search --query "工作主题" --scope workspace --visibility shared,global --limit 10` |
| 对话中信息不足、需历史佐证 | 按当前意图补一次 `search` |

读取后的判断（Agent 负责）：
- **相关性高**（score ≥ 0.5）的记忆注入回复，并注明来源："基于此前关于 [topic] 的讨论…"。
- **无强相关**（最高分 < 0.3）时**不注入**——保持对话纯净，宁可漏注不可错注。
- 中文整句查询已自动支持（检索打分内置 n-gram 窗口），无需分词、无需额外参数。

---

> **以下为高级参考章节**，适用于需要深入理解机制或排查复杂场景时查阅。
> 新手和日常使用可跳过，先掌握上方核心规则即可。

---

## Auto-Extract Signals

对话中命中以下信号即主动提取存储（单次对话上限 5 条，宁缺毋滥）：

| 信号 | 触发模式 | type | 默认 priority |
|------|----------|------|---------------|
| 决策 | "选 X 而非 Y"、"决定用…" | decision | P1 |
| 排障 | "问题是…修复是…" | debug_solution | P1 |
| 流程 | "部署要先…再…" | workflow | P2 |
| 偏好 | "我喜欢…"、"偏好…" | preference | P2 |
| 事实 | "项目用 X 技术栈" | fact | P2 |
| 状态 | "进度到第 N 步"、"待办…" | state | P3 |
| 事件 | "vX 发布了"、"完成了…" | event | P3 |
| 关系 | "A 依赖 B" | relation | P2 |
| 显式 | 用户说"记住/remember" | 按内容 | P1 |

存储流程：识别信号 → CLI compress（可选）→ **Agent 用自身能力压缩为 ≤200 字 summary** → store 落盘。
分工铁律：CLI 做确定性工作（解析/落盘/索引），Agent 做语义工作（识别/压缩/分类）。

## Auto-Recall & Injection

新对话开始或用户引用历史时：

1. 从请求提取 2-3 个关键词 + 判断是否接手他人工作。
2. 普通场景：`search --query "关键词" --scope all --as-agent <your-id> --limit 5 --output r.json`。
3. 接手场景（同一工作内容换 Agent/换会话）：`search --query "工作主题" --scope workspace --visibility shared,global --limit 10 --output r.json`，读取前序 Agent 的工作记忆注入上下文。
4. 高度相关（score > 0.5）的记忆注入回复；注入时说明来源："基于此前关于 [topic] 的讨论…"。
5. 若最高分 < 0.3：**不注入**，保持对话纯净（宁可漏注，不可错注）。

## Multi-Agent Collaboration Rules

> 本 skill 的核心价值：多会话、多 Agent 针对**相同工作内容**的共享记忆。

1. **身份**：用 `--agent-id <你的ID>` 存储（或设环境变量 `MEMORY_AGENT_ID`）。若未设置，先存一条 private 记忆声明"agent:<id> 是 <角色>"。
2. **贡献**：工作区记忆默认 `shared`，写清楚"我做了什么、进展到哪、发现了什么约束"。
3. **消费**：接手时按主题检索 `shared`/`global` 记忆，接上之前的工作，不重复提问。
4. **再贡献**：接手后产出新记忆仍默认 `shared`，让下一个 Agent 继续接力。
5. **隐私**：他人的 `private` 记忆自动不可见（`--as-agent` 过滤），不要尝试绕过。

## 无 CLI 环境的降级路径（可选，Agent 直读 JSON）

> 若宿主平台无 Node.js 环境，**Agent 可直接读写 JSON 记忆文件**——记忆库本质是 JSON，Agent 原生可理解。**但直读有 token 成本上限（见下方规模分级），CLI 仍优先**——它把"全量扫描"压缩为"top-N 注入"，token 成本恒定。

**记忆文件位置**：
- 全局库：`~/.memory-store/memories.json`
- 工作区库：`{workspace}/.agents/memory-store/memories.json`

**记录（降级 store）**：读取目标 memories.json → 按 v2 数据模型（见 `references/memory_schema.json`）追加一条记忆（含 `id/scope/visibility/type/title/summary/tags/importance/priority/created_at` 等字段）→ **原子写**（先写 `memories.json.tmp` 再改名替换）。

**检索（降级 search）——按记忆规模分级，token 可控**：

| 记忆规模 | 直读策略 | token 成本 | 说明 |
|---------|---------|-----------|------|
| <100 条 | 直读全文，LLM 语义判断 | ~2 万 token 内 | 语义质量最好（同义词/跨语言可命中） |
| 100–1000 条 | **索引粗筛 + 候选直读**：先读 `memories.index.json`（倒排索引，仅 token→id 映射，比全文小 10 倍+）按关键词粗筛候选 id → 只直读候选条目全文 → LLM 语义精排 | 索引 ~1-2 万 + 候选 ~数千 | 分步降级，避免全量进上下文 |
| >1000 条 | **必须用 CLI**（确定性检索 top-N 注入，token 恒定）；直读全文已超出上下文窗口 | CLI 恒定 ~1000 | 无 CLI 时建议先 `archive` 压缩库再考虑直读 |

> [!IMPORTANT]
> **直读全文的 token 成本是 O(记忆总数)，CLI 检索是 O(top-N) 恒定**——记忆越多差距越大（千条级差 ~200 倍）。这是 CLI 不可替代的价值之一。直读降级**仅在记忆库小（<100 条）时是合理的"增强路径"**（LLM 语义判断比关键词打分准）；规模大了必须用 CLI 或"索引粗筛+候选直读"分步降级。

**维护（降级 archive）**：按规则清理——`ttl_days` 过期、长期未被访问且重要性低、或按衰减直觉判断不再有价值的记忆，移入 `archive/archived_YYYYMM.json`。

> [!IMPORTANT]
> 降级路径中，CLI 的确定性能力（原子写/统一格式/打分排序）由你按上述规则手动执行。**语义判断本来就该由你做**——直读 JSON 时，相关性判断用你的 LLM 能力，而非模拟关键词打分。

## Maintenance

- 对话结束时（或每周）：`archive --scope global --apply-decay` + `archive --scope workspace --apply-decay` 清理过期记忆。
- 定期 `merge` 相似记忆，避免冗余。
- `list --status archived` 检查归档，确认可物理清理的项用 `delete` 清除。
- 记忆膨胀会影响检索性能——维护是 skill 的例行工作，不是可选项。

## 边界条件（Edge Cases）

> 本章节集中列出记忆库在使用中可能遇到的边界情况，方便快速查阅。
> 每个条目后附有指向详细章节的链接。

### 1. 搜索无命中

当 `search --query` 返回空结果时：

1. 确认关键词是否过窄——尝试更宽泛的查询词，或去掉 `--scope` 限制
2. 确认可见性过滤是否正确——`--visibility` 是否排除了目标记忆？`--as-agent` 是否过滤了 shared 记忆？
3. 确认记忆库是否已初始化——`init --scope global|workspace`
4. 以上均确认后，再考虑读项目文件补充，并在回答中说明"记忆库未找到，从项目文件补充"

→ 详见 [Agent 持续判断触发](#agent-持续判断触发触发权在-agent)

### 2. 存储上限

单次对话最多存储 **5 条**记忆（宁缺毋滥）。若达上限后仍有可记录内容：

- 优先更新已有记忆（`update --id`）而非新建
- 或评估是否可合并（`merge`）

→ 详见 [按需记录](#按需记录对话中实时触发)

### 3. 相关性阈值

| 阈值 | 含义 |
|------|------|
| score ≥ 0.5 | 注入回复，并注明来源 |
| 0.3 ≤ score < 0.5 | 人工判断是否注入 |
| score < 0.3 | 不注入，保持对话纯净 |

→ 详见 [按需读取](#按需读取对话中适时触发)

### 4. TTL 过期与衰减

以下任一条件满足，`archive` 会将记忆移入归档：

- `ttl_days` 已过期
- 衰减分 < 0.15
- 60 天未访问且重要性低

→ 详见 [archive 命令](#archive--归档过期记忆衰减判据)、[Maintenance](#maintenance)

### 5. 默认可见性

| 场景 | 默认 scope | 默认 visibility |
|------|-----------|----------------|
| 未指定 scope | global | global |
| `--scope global` | 全局库 | global |
| `--scope workspace` | 工作区库 | shared |

→ 详见 [store 命令](#store--存储一条记忆)

### 6. 并发写入

多 Agent 同时写入同一记忆文件时，CLI 使用原子写入策略（先写 `.tmp` 再重命名），避免数据损坏。但如果两个 Agent 同时写不同内容，**后写入的会覆盖先写入的**。建议：

- 不同 Agent 写不同 `--type` 或 `--tags` 的记忆，减少冲突面
- 避免同时大量写入同一 scope 的库
- 使用 `--source-conv-id` 区分来源，方便追溯

### 7. 中文查询

`search` 已内置 n-gram 窗口支持中文整句查询，无需分词、无需额外参数。中文关键词和英文关键词混合查询同样支持，检索打分时不区分语言。

→ 详见 [按需读取](#按需读取对话中适时触发)

### 8. 无 CLI 环境

若宿主平台无 Node.js 环境，Agent 可直接读写 JSON 记忆文件——记忆库本质是 JSON（`memories.json`），Agent 原生可理解。但需注意 token 成本随记忆规模线性增长，详见完整降级方案。

→ 详见 [无 CLI 环境的降级路径](#无-cli-环境的降级路径可选agent-直读-json)

### 9. 跨平台路径

所有平台共享同一个**全局记忆库** `~/.memory-store/`，但 skill 安装路径不同（`~/.claude/skills/`、`~/.gemini/skills/` 等）。工作区记忆库 `.agents/memory-store/` 固定在项目目录下，跨平台一致。

→ 详见 [Supported Platforms](#supported-platforms)

### 10. `--as-agent` 身份过滤

检索时 `--as-agent <your-id>` 会自动过滤他人的 `private` 记忆，同时确保看到正确的 `shared` 记忆。**不传身份可能看到不该看的，或看不到共享记忆**——身份一致性对多 Agent 协作至关重要。

→ 详见 [Multi-Agent Collaboration Rules](#multi-agent-collaboration-rules)

## Common Mistakes

1. **存太多低价值记忆** — 每条都存会导致信噪比下降。默认：未来用不上的不存。→ 详见 [边界条件 §2 存储上限](#2-存储上限)
2. **忘记可见性** — 工作区记忆默认已 shared；全局知识务必存 global 库；隐私/密钥必须 private。→ 详见 [边界条件 §5 默认可见性](#5-默认可见性)
3. **存原始对话文本** — 先压缩成 1-2 句总结再存，否则难检索、浪费空间。
4. **检索时忽略 --as-agent** — 不传身份会看到别人的 private 记忆（或看不到共享记忆），身份一致性很重要。→ 详见 [边界条件 §10 --as-agent 身份过滤](#10---as-agent-身份过滤)
5. **从不维护** — 不归档会导致记忆库膨胀、检索变慢。维护要例行执行。→ 详见 [边界条件 §4 TTL 过期与衰减](#4-ttl-过期与衰减)
