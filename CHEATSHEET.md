# Memory Store — 速查表 (Cheat Sheet)

> 一页纸快速参考。完整说明见 [SKILL.md](SKILL.md)。

## CLI 命令一览

| 命令 | 用途 | 必填参数 | 关键可选参数 |
|------|------|---------|-------------|
| `init` | 初始化存储目录 | `--scope global\|workspace` | — |
| `store` | 存储一条记忆 | `--type --title --summary --importance` | `--tags --priority --scope --visibility --agent-id --ttl-days` |
| `search` | 检索记忆 | `--query --output` | `--scope --visibility --as-agent --limit` |
| `recall` | 取完整详情 | `--id --output` | — |
| `list` | 列出记忆 | `--output` | `--scope --type --status --visibility --sort-by` |
| `update` | 更新记忆 | `--id` | `--visibility --priority --importance --tags` |
| `delete` | 删除记忆 | `--id` | — |
| `merge` | 合并相似记忆 | `--ids` | — |
| `archive` | 归档过期记忆 | `--scope` | `--apply-decay --min-decay --before-days` |
| `stats` | 统计分布 | `--scope` | `--output` |
| `compress` | 从 transcript 提取候选 | `--input` | `--output` |

## 快速示例

### 存储
```bash
# 决策（工作区协作共享）
node scripts/memory_cli.js store --type decision --title "数据库选型" \
  --summary "选择 SQLite 而非 PostgreSQL" --tags "database" \
  --importance 0.85 --priority P1 --scope workspace --visibility shared

# 偏好（全局可见）
node scripts/memory_cli.js store --type preference --title "代码风格" \
  --summary "使用 2 空格缩进" --tags "style" \
  --importance 0.6 --scope global
```

### 检索
```bash
# 跨层搜索
node scripts/memory_cli.js search --query "数据库" --scope all --limit 5 --output r.json

# 按类型过滤
node scripts/memory_cli.js search --query "部署" --type workflow --scope all --limit 3

# 接手他人工作（拉 shared 记忆）
node scripts/memory_cli.js search --query "项目进度" --scope workspace --visibility shared --limit 10
```

### 维护
```bash
node scripts/memory_cli.js archive --scope all --apply-decay --min-decay 0.15 --output archived.json
node scripts/memory_cli.js merge --ids mem_xxx,mem_yyy
node scripts/memory_cli.js stats --scope all --output stats.json
```

## 记忆类型

| 类型 | 用途 | 默认 priority |
|------|------|---------------|
| `decision` | 技术选型/架构决策 | P1 |
| `debug_solution` | 排障方案 | P1 |
| `workflow` | 部署/操作流程 | P2 |
| `preference` | 用户偏好/习惯 | P2 |
| `fact` | 事实/配置信息 | P2 |
| `state` | 进度/状态/待办 | P3 |
| `event` | 发布/完成事件 | P3 |
| `relation` | 依赖/关联关系 | P2 |

## 可见性三档

| visibility | 谁可读 | 默认场景 |
|------------|--------|---------|
| `global` | 所有 Agent（跨项目） | 全局库记忆 |
| `shared` | 同工作区协作 Agent | 工作区记忆 |
| `private` | 仅写入者 | 隐私/临时内容 |

## 关键阈值

| 项目 | 值 |
|------|-----|
| 单次对话存储上限 | 5 条 |
| 注入阈值 | score ≥ 0.5 |
| 不注入阈值 | score < 0.3 |
| 归档衰减分阈值 | < 0.15 |
| 自动归档天数 | 60 天未访问 |
| 锁超时 | 30 秒 |

## 路径

| 存储层 | 位置 |
|--------|------|
| 全局库 | `~/.memory-store/` |
| 工作区库 | `{project}/.agents/memory-store/` |
| 归档 | `{store}/archive/archived_YYYYMM.json` |