# Memory Store v1.0.5 — 速查表

从 skill 目录执行：`node scripts/memory_cli.js <command>`。要求 Node.js 18+。

## 安装与更新

```bash
npm i memory-store-skill
npx memory-store-install --agent codex --memory-profile explicit

# 先升级 npm 包，再同步已有安装
npm i memory-store-skill@latest
npx memory-store-update

# 预览或只更新一个平台
npx memory-store-update --dry-run
npx memory-store-update --agent codex
```

npm 安装不会自动修改 Agent 目录。更新器只从当前本地包刷新已有 skill 安装并校验文件，不下载或执行远程代码，也不修改记忆数据。源码安装可使用 `node scripts/install.js --update`。

## 记忆策略

```bash
node scripts/memory_cli.js config show --scope effective --stdout
node scripts/memory_cli.js config set --profile balanced --scope global --stdout
node scripts/memory_cli.js config set --profile explicit --scope workspace --stdout
node scripts/memory_cli.js config reset --scope workspace --stdout
```

档位：`off`、`explicit`（默认）、`balanced`、`proactive`。显式请求使用 `--intent explicit`；策略触发使用 `--intent automatic`。

## 输出

```bash
# 默认 JSON 到 stdout；--stdout 是显式形式
node scripts/memory_cli.js stats --scope all --stdout

# 需要文件时
node scripts/memory_cli.js stats --scope all --output stats.json
```

## 常用命令

| 命令 | 必要参数 | 常用参数 |
|---|---|---|
| `init` | `--scope global\|workspace` | `--stdout` |
| `config` | `show\|set\|reset` | `--profile --scope` |
| `store` | `--type --title --summary` | `--intent --source-conv-id --importance --tags --scope --visibility --priority --ttl-days --agent-id` |
| `search` | `--query` | `--intent --scope --type --visibility --as-agent --limit --touch` |
| `recall` | `--id` | `--as-agent` |
| `list` | — | `--scope --type --status --visibility --as-agent` |
| `update` | `--id` | `--importance --priority --visibility --tags --as-agent` |
| `delete` | `--id` | `--as-agent` |
| `merge` | `--ids` | `--scope --as-agent` |
| `archive` | — | `--scope --apply-decay --min-decay --before-days` |
| `restore` | `--id` | `--as-agent`; `revive` 为别名 |
| `stats` | — | `--scope` |
| `compress` | `--input` | — |
| `migrate` | — | `--dry-run` |
| `version` | — | 也支持 `-v` / `--version` |

## 存储与检索

```bash
# 工作区共享决策
node scripts/memory_cli.js store \
  --type decision --title "数据库选型" \
  --summary "选择 SQLite；当前为单用户本地部署。" \
  --tags "database,architecture" --importance 0.85 --priority P1 \
  --scope workspace --visibility shared --agent-id agent-a --stdout

# 多类型跨层搜索；默认只读
node scripts/memory_cli.js search \
  --query "数据库 选型" --scope all \
  --type decision,debug_solution \
  --as-agent agent-a --limit 5 --stdout

# 仅在希望记录实际命中访问时加 --touch
node scripts/memory_cli.js search \
  --query "部署流程" --scope all --as-agent agent-a \
  --limit 5 --touch --stdout
```

## 任务交接

```bash
node scripts/memory_cli.js search \
  --query "任务主题 进度" --scope workspace \
  --visibility shared,global --as-agent agent-b --limit 10 --stdout
```

## 归档与恢复

```bash
node scripts/memory_cli.js archive \
  --scope all --apply-decay --min-decay 0.15 --stdout

node scripts/memory_cli.js list \
  --scope all --status archived --as-agent agent-a --stdout

node scripts/memory_cli.js recall \
  --id mem_xxx --as-agent agent-a --stdout

node scripts/memory_cli.js restore \
  --id mem_xxx --as-agent agent-a --stdout
```

普通 search 不检索归档；不要使用未文档化的 `--include-archived`。

## 枚举

| 字段 | 值 |
|---|---|
| type | `fact`, `decision`, `preference`, `workflow`, `debug_solution`, `state`, `event`, `relation` |
| visibility | `private`, `shared`, `global` |
| scope | `global`, `workspace`;聚合命令支持 `all` |
| priority | `P1`, `P2`, `P3` |

## 安全与并发

- `private` 是 Agent 身份过滤，不是加密；不要存密钥、凭据、令牌或原始个人信息。
- 原子替换防止半文件，但不提供完整事务锁；并发写入仍可能最后写覆盖。
- 批量 archive、merge、delete 前备份 `memories.json` 与 `archive/`。
- JSON 损坏时 CLI 应失败退出，不要当空库继续写入。

完整说明见 [references/cli.md](references/cli.md) 与 [references/operations.md](references/operations.md)。
