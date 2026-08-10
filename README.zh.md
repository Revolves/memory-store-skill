# Memory Store Skill

[English](README.en.md)

**面向跨会话、多 Agent 协作的结构化记忆 skill。**

Agent 负责识别值得保留的决策、排障、偏好、流程和状态；纯 Node.js CLI 负责校验、存储、检索、归档与恢复。没有后台进程，也不会扫描所有对话。

安装前请阅读 [安全边界](SECURITY.md)：本项目没有安装生命周期脚本、后台进程或自动网络请求，`private` 也不是加密边界。

## 安装

要求 Node.js 18 或更高版本。当前版本已发布到 npm，推荐直接安装：

```bash
npm i memory-store-skill
npx memory-store-install --agent codex --memory-profile explicit
```

npm 包安装不会运行生命周期脚本，也不会自动修改任何 Agent 目录。第二条显式命令才会把 skill 安装到 Codex；安装完成后，请新开一个 Agent 会话，让平台重新发现 skill。

验证安装：

```bash
npx memory-store version
```

如果需要查看平台标识或安装到其他平台：

```bash
npx memory-store-install --list
npx memory-store-install --agent codex
```

其他平台标识包括 `claude`、`gemini`、`opencode`、`workbuddy`、`cursor`、`windsurf`、`qoderworkcn` 和 `trae-cn`。

### 记忆策略

| 档位 | 行为 |
|---|---|
| `off` | 禁止自动检索和自动存储，显式命令仍可用 |
| `explicit` | 仅响应用户明确的“记住/回忆”请求，安全默认值 |
| `balanced` | 自动保留精选的决策、排障、流程和偏好，每次对话最多 3 条 |
| `proactive` | 自动保留更广泛的耐久记忆，每次对话最多 5 条 |

安装后可以查看或修改全局策略，也可以设置当前工作区覆盖：

```bash
npx memory-store config show
npx memory-store config set --profile balanced --scope global
npx memory-store config set --profile explicit --scope workspace
npx memory-store config reset --scope workspace
```

## 更新

```bash
npm i memory-store-skill@latest
npx memory-store-update
```

第一条命令由用户显式升级 npm 包；更新器只从当前本地包同步已经安装的 skill，复制后自动校验文件，不会下载或执行远程代码、修改记忆数据，也不会把未安装的平台变成新安装。

```bash
# 只预览，不写入
npx memory-store-update --dry-run

# 只更新指定平台
npx memory-store-update --agent codex

# 更新自定义安装目录
npx memory-store-update --target /path/to/memory-store
```

更新完成后请新开 Agent 会话。源码用户也可以在仓库中运行 `node scripts/install.js --update`，用当前源码刷新已有安装。

### 从源码安装

适合参与开发、检查源码或使用尚未发布的版本：

```bash
git clone https://github.com/Revolves/memory-store-skill.git
cd memory-store-skill
node scripts/install.js --all
```

## 核心模型

| 维度 | 值 | 用途 |
|---|---|---|
| scope | `global` | 跨项目稳定偏好、通用知识 |
| scope | `workspace` | 当前项目决策、进度、排障与交接 |
| visibility | `global` | 跨项目协作可见 |
| visibility | `shared` | 当前工作区协作可见 |
| visibility | `private` | 仅匹配 `owner_agent` 的 CLI 请求返回 |

> `private` 只是基于 Agent 身份的协作过滤。JSON 文件是明文；拥有文件读取权限的用户或进程仍可直接查看。CLI 不自动检测或脱敏密钥、凭据、令牌和个人信息，请勿存储秘密。

支持 8 类记忆：`fact`、`decision`、`preference`、`workflow`、`debug_solution`、`state`、`event`、`relation`。

## 5 分钟上手

以下示例使用 npm 提供的 CLI，无需进入 skill 安装目录。

### 1. 确认版本

```bash
npx memory-store version
```

命令会输出当前安装版本；本仓库源码版本见 `package.json`。

### 2. 存储工作区决策

```bash
npx memory-store store \
  --type decision \
  --title "数据库选型" \
  --summary "选择 SQLite；当前为单用户本地部署。" \
  --tags "database,architecture" \
  --importance 0.85 --priority P1 \
  --scope workspace --visibility shared \
  --agent-id agent-a --stdout
```

### 3. 检索

```bash
npx memory-store search \
  --query "数据库 选型" --scope all \
  --type decision,debug_solution \
  --as-agent agent-a --limit 5 --stdout
```

默认已经输出 JSON 到 stdout；`--stdout` 只是显式写法。需要文件时使用 `--output result.json`。

### 4. 交接给其他 Agent

```bash
npx memory-store search \
  --query "任务主题 进度" --scope workspace \
  --visibility shared,global --as-agent agent-b --limit 10 --stdout
```

## Agent 何时检索

- **必须检索**：用户问之前的讨论、决策、进度、偏好、惯例、排障，或 Agent 接手任务。
- **按需检索**：新会话明显延续既有工作，或当前上下文缺少历史依据。
- **无需检索**：一次性、自包含、与历史无关的问题。

working memory 不能替代对具体历史的检索。若记忆库无命中，再读取项目文件补充，并明确数据来源。

## 常用命令

| 命令 | 用途 |
|---|---|
| `init` | 初始化 global 或 workspace 存储 |
| `store` | 写入结构化记忆 |
| `search` | 跨层搜索与过滤 |
| `recall` | 按 ID 读取并记录访问 |
| `list` | 列出 active 或 archived 记忆 |
| `update` | 更新记忆字段 |
| `delete` | 删除 active 记忆 |
| `merge` | 合并确认重复的 active 记忆 |
| `archive` | 将过期/低价值记忆移出主库 |
| `restore` | 将归档记忆恢复到主库（`revive` 为兼容别名） |
| `stats` | 查看分布与数量 |
| `compress` | 从 transcript 提取候选片段 |
| `migrate` | 迁移旧版全局存储 |

完整参数见 [references/cli.md](references/cli.md)，维护、隐私、并发与恢复边界见 [references/operations.md](references/operations.md)。

## 重要限制

- 原子替换可防止半文件和临时文件冲突，但没有覆盖完整 read-modify-write 的事务锁；高并发写入仍可能发生最后写覆盖。
- `archive --scope all` 可处理两层，也可分别使用不同阈值；用 `list --status archived`、`recall` 和 `restore` 检查与恢复。
- 损坏 JSON 会令 CLI 失败退出，不应被当成空库继续写入。
- `compress` 只提取候选，不会自动总结，也不会检测敏感信息。
- 性能取决于机器、Node.js 版本、磁盘与记忆规模；请以自己的基准为准。

## 文档

- [SKILL.md](SKILL.md)：Agent 的最小行为规则
- [CHEATSHEET.md](CHEATSHEET.md)：一页命令速查
- [FAQ.md](FAQ.md)：常见问题与边界

## License

MIT License.
