[![中文](https://img.shields.io/badge/🇨🇳-中文-blue)](README.zh.md) [![English](https://img.shields.io/badge/🇬🇧-English-green)](README.en.md)

# Memory Store Skill

**自动对话记忆存储、共享与检索 · 面向多 Agent 协同的 AI 工作场景**

> 一个面向 AI 工作场景的全局、多任务、多对话记忆技能（skill）。Agent 在对话中自动判断触发，把值得保留的信息结构化存储为记忆；新会话、新 Agent 接手时按需检索注入，实现"同一工作内容、不同会话、不同 Agent"的共享记忆闭环。

---

## 目录

1. [项目介绍](#1-项目介绍)
2. [核心特性](#2-核心特性)
3. [架构概览](#3-架构概览)
4. [安装部署](#4-安装部署)
5. [使用方式](#5-使用方式)
6. [目录结构](#6-目录结构)

---

## 1. 项目介绍

Memory Store 是一个**轻量级对话记忆技能**，服务于 AI Agent 工作场景。它解决三类问题：

1. **跨会话遗忘**：对话结束后，关键决策、排障方案、用户偏好会随上下文丢失 → 结构化存储，下次自动想起。
2. **多 Agent 不共享**：多个 Agent 会话处理同一工作内容时互相不知道对方进度 → 通过 `shared` 可见性共享，接手即知前序工作。
3. **记忆膨胀**：记忆越积越多，检索变慢、信噪比下降 → 衰减机制 + 归档清理，保持长期可用。

设计坚持 **Skill 基本线**：`SKILL.md` 是指令核心，CLI 是轻量支撑工具（纯 Node.js 内置模块、零依赖），不构建独立软件系统、不设后台进程。语义判断（什么值得记、如何压缩、何时检索）交给 Agent 的 LLM 能力，CLI 只做确定性的存储与检索。

---

## 2. 核心特性

| 特性 | 说明 |
|------|------|
| 两层分层 | `global`（全局共享，跨项目）+ `workspace`（工作区协作，同任务共享） |
| 三档可见性 | `private`（仅自己）/ `shared`（同工作内容协作 Agent）/ `global`（所有 Agent） |
| 8 类记忆 | fact / decision / preference / workflow / debug_solution / state / event / relation |
| Agent 判断触发 | 对话中由 Agent 自主识别信号，决定何时存储、何时检索 |
| 自动压缩 | Agent 用 LLM 能力把原文压缩为精炼摘要再存，不存原文 |
| 生命周期 | 衰减评分 + 归档（TTL/衰减/重要性三重判据）+ 合并去冗余 |
| 中文检索 | 内置 n-gram 窗口，中文整句查询无需分词即可命中 |
| 原子写 | 临时文件 + 原子替换，多 Agent 并发写入不损坏数据 |
| 多平台 | 自动检测并安装至 Claude Code / Codex / Antigravity / Gemini / OpenCode / Cline / Roo |

---

## 3. 架构概览

```
┌─────────────────────────────────────────────────────┐
│  Agent 协作层（多 Agent / 多会话，各持身份）           │
└───────────────┬─────────────────────────────────────┘
                │ 对话中判断触发（LLM 语义判断）
┌───────────────▼─────────────────────────────────────┐
│  工作区记忆 workspace scope                            │
│  {workspace}/.agents/memory-store/   默认 shared      │
│  └ 当前项目/任务上下文、进度状态、中间决策             │
└───────────────┬─────────────────────────────────────┘
                │ 沉淀 promote / 回灌 inject
┌───────────────▼─────────────────────────────────────┐
│  全局记忆 global scope                                │
│  ~/.{platform}/memory-store/         默认 global      │
│  └ 用户偏好、通用知识、历史决策（跨项目共享）           │
└─────────────────────────────────────────────────────┘
```

- **存储格式**：JSON 文件（Agent 可直接读写、便于备份迁移、千条级性能足够）
- **并发控制**：原子写（tmp + 原子替换），无锁、无事件总线、无守护进程
- **分工**：CLI 做确定性工作（解析/去重/落盘/索引/打分），Agent 做语义工作（识别/压缩/分类/触发判断）

---

## 4. 安装部署

### 方式零：npm 全局安装（推荐）

```bash
npm install -g memory-store-skill

# 安装后全局可用：
memory-store search --query "数据库" --limit 5 --output r.json
memory-store-install --all
```

或免安装直接运行：

```bash
npx memory-store-skill search --query "记忆" --limit 3 --output /tmp/r.json
```

### 方式一：本地脚本安装

```bash
# 自动检测并安装到所有已安装的 AI Agent 平台
node scripts/install.js --all

# 安装到指定平台，同时安装项目级 skill
node scripts/install.js --agent claude --project

# 查看可安装的平台列表
node scripts/install.js --list
```

### 方式二：手动复制

```bash
cp -r memory-store ~/.claude/skills/        # Claude Code
cp -r memory-store ~/.workbuddy/skills/     # WorkBuddy
cp -r memory-store .agents/skills/          # 项目级
```

安装后**新开会话**生效。脚本路径相对 skill 目录：`node scripts/memory_cli.js`（纯 Node.js 内置模块，无需第三方依赖）。

---

## 5. 使用方式

### 5.1 CLI 子命令

| 子命令 | 用途 | 关键参数 |
|--------|------|----------|
| `init` | 初始化存储目录 | `--scope global|workspace` |
| `store` | 存储一条记忆 | `--type/--title/--summary/--tags/--importance/--priority/--visibility/--scope/--agent-id/--ttl-days` |
| `search` | 检索记忆（跨层/可见性过滤） | `--query/--scope all/--visibility/--as-agent/--limit` |
| `recall` | 按 ID 取详情（+1 访问计数） | `--id` |
| `list` | 列出记忆（过滤/排序） | `--scope/--type/--tags/--status/--visibility/--sort-by` |
| `update` | 更新记忆（可升级可见性） | `--id/--visibility/--priority/--importance` |
| `delete` | 删除记忆 | `--id` |
| `merge` | 合并相似记忆 | `--ids` |
| `archive` | 归档过期/低价值记忆 | `--apply-decay/--min-decay/--before-days` |
| `stats` | 统计（层/可见性/类型分布） | `--scope all` |
| `compress` | 从 transcript 提取候选片段 | `--input` |

### 5.2 快速示例

```bash
# 存储一条决策记忆（工作区协作共享）
memory-store store \
  --type decision --title "数据库选型" \
  --summary "选择 SQLite 而非 PostgreSQL，单用户场景" \
  --tags "database,architecture" --importance 0.85 --priority P1 \
  --scope workspace --visibility shared --agent-id agent-a

# 新会话检索相关记忆
memory-store search \
  --query "数据库选型" --scope all --as-agent agent-b --limit 5 --output r.json

# 接手他人工作：拉取前序 Agent 的 shared 记忆
memory-store search \
  --query "工作主题" --scope workspace --visibility shared,global --limit 10

# 例行维护：归档低价值/过期记忆
memory-store archive --scope all --apply-decay --min-decay 0.15 --output a.json
```

### 5.3 Agent 调用视角

本 skill 的调用方式：**Agent 在对话中自主决策、调用 CLI**。

- **按需记录**：对话中识别到值得保留的信息（决策/排障/偏好/事实/状态…）→ LLM 压缩为精炼摘要 → 调用 `store` 存储。
- **按需读取**：新对话、话题延续、任务交接、用户引用历史时主动 `search` 检索相关记忆，注入到当前上下文。

---

## 6. 目录结构

```
memory-store/
├── SKILL.md                      # 技能指令核心（触发词 + Agent 行为规则）
├── README.md / README.zh.md      # 本文档（中文版）
├── scripts/
│   ├── memory_cli.js             # 核心 CLI（11 子命令，纯 Node 内置模块）
│   └── install.js                # 自动安装脚本（检测 Agent 平台 + 安装）
├── references/
│   └── memory_schema.json        # 数据契约（JSON Schema）
├── examples/
│   └── example_memories.json     # 示例记忆（含 shared/private 协作示例）
├── package.json                  # npm 包配置
```

---

## 许可证

MIT License。