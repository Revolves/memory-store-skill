# 常见问题 (FAQ)

> 遇到问题先查这里，每条附指向 `SKILL.md` 的详细章节链接。

---

## 基础概念

### Q1: 记忆存了之后，其他 Agent 会话能读到吗？

**能，但取决于可见性。** 记忆分为三个可见性层级：

| visibility | 谁可读 | 典型场景 |
|------------|--------|----------|
| `global` | 所有 Agent（跨项目） | 用户偏好、通用知识 |
| `shared` | 同工作区/同任务的协作 Agent | 工作内容、进度状态 |
| `private` | 只有写入的 Agent 自己 | 内部思考、临时草稿、敏感信息 |

> 想让其他 Agent 看到 → 存 `--visibility shared` 或 `--visibility global`。
> 不想让别人看到 → 存 `--visibility private`。

→ 详见 [Two-Layer Model & Visibility](#two-layer-model--visibility)

### Q2: 全局记忆和工作区记忆有什么区别？

| 维度 | 全局记忆 (global) | 工作区记忆 (workspace) |
|------|------------------|----------------------|
| 存储位置 | `~/.memory-store/` | `{project}/.agents/memory-store/` |
| 跨项目 | ✅ 所有项目可见 | ❌ 仅当前项目可见 |
| 默认可见性 | `global` | `shared` |
| 典型用途 | 用户偏好、技术选型决策 | 当前任务进度、中间决策 |

→ 详见 [Two-Layer Model & Visibility](#two-layer-model--visibility)

### Q3: 记忆有哪些类型？

8 种类型：`fact`（事实）、`decision`（决策）、`preference`（偏好）、`workflow`（工作流）、`debug_solution`（排障方案）、`state`（状态）、`event`（事件）、`relation`（关系）。

→ 详见 [Auto-Extract Signals](#auto-extract-signals)

---

## 存储与检索

### Q4: 记忆存了为什么搜不到？

排查步骤：

1. **关键词是否过窄** — 尝试更宽泛的查询词，或去掉 `--scope` 限制
2. **可见性过滤是否正确** — `--visibility` 是否排除了目标记忆？`--as-agent` 是否过滤了 shared 记忆？
3. **记忆库是否已初始化** — 未初始化时 `search` 返回空，需先执行 `init --scope global|workspace`
4. **记忆是否已过期/归档** — 检查 `archive` 是否已将其移入归档

> 以上均确认后，再考虑读项目文件补充，并在回答中说明"记忆库未找到，从项目文件补充"。

→ 详见 [边界条件 §1 搜索无命中](#1-搜索无命中)

### Q5: 一次对话最多能存多少条记忆？

**单次对话最多 5 条。** 宁缺毋滥。若达上限后仍有可记录内容：

- 优先更新已有记忆（`update --id`）而非新建
- 或评估是否可合并（`merge`）

→ 详见 [边界条件 §2 存储上限](#2-存储上限)

### Q6: 搜索结果的相似度阈值是多少？

| 阈值 | 含义 |
|------|------|
| score ≥ 0.5 | 注入回复，并注明来源 |
| 0.3 ≤ score < 0.5 | 人工判断是否注入 |
| score < 0.3 | 不注入，保持对话纯净 |

→ 详见 [边界条件 §3 相关性阈值](#3-相关性阈值)

### Q7: 支持中文搜索吗？

**支持。** `search` 已内置 n-gram 窗口支持中文整句查询，无需分词、无需额外参数。中文关键词和英文关键词混合查询同样支持。

→ 详见 [边界条件 §7 中文查询](#7-中文查询)

### Q8: 搜索结果是按什么排序的？

按相关性综合打分排序，考量因素包括：关键词匹配、标签匹配、记忆类型、时间衰减、重要性权重、可见性层级。

→ 详见 [search 命令](#search--检索记忆含可见性过滤)

---

## 可见性与协作

### Q9: 如何让其他 Agent 看到我的记忆？

存为 `--visibility shared`（工作区默认）或 `--visibility global`（全局库默认）。检索时对方需使用 `--as-agent` 带上自己的身份 ID。

```bash
# 存为 shared（工作区协作）
node scripts/memory_cli.js store --type decision --title "..." --summary "..." \
  --scope workspace --visibility shared --agent-id agent-a

# 对方检索
node scripts/memory_cli.js search --query "..." --scope workspace --visibility shared,global --as-agent agent-b
```

→ 详见 [Multi-Agent Collaboration Rules](#multi-agent-collaboration-rules)

### Q10: 什么场景应该存 `private`？

- 涉及用户隐私、密钥、凭据的信息
- 临时内部思考、未完成的草稿
- 不希望被同工作区其他 Agent 看到的内容

> 敏感信息检测到密钥/凭据/PII 时，记忆会被强制锁定为 `private` 且不入归档。

→ 详见 [边界条件 §10 --as-agent 身份过滤](#10---as-agent-身份过滤)

### Q11: `--as-agent` 不传身份会怎样？

可能看到别人的 `private` 记忆（如果直接读文件），或反过来看不到共享记忆。**身份一致性对多 Agent 协作至关重要。**

→ 详见 [边界条件 §10 --as-agent 身份过滤](#10---as-agent-身份过滤)

### Q12: 多个 Agent 同时写记忆会冲突吗？

CLI 使用原子写入策略（先写 `.tmp` 再重命名），不会导致数据损坏。但**后写入的会覆盖先写入的**。建议：

- 不同 Agent 写不同 `--type` 或 `--tags` 的记忆，减少冲突面
- 避免同时大量写入同一 scope 的库
- 使用 `--source-conv-id` 区分来源，方便追溯

→ 详见 [边界条件 §6 并发写入](#6-并发写入)

---

## 维护与管理

### Q13: 记忆会自动过期吗？

**会，但不自动删除。** `archive` 命令根据以下条件将记忆移入归档：

- `ttl_days` 已过期
- 衰减分 < 0.15
- 60 天未访问且重要性低

归档后的记忆默认不参与检索，如需查看需 `--include-archived` 参数或查看 `list --status archived`。

→ 详见 [边界条件 §4 TTL 过期与衰减](#4-ttl-过期与衰减)

### Q14: 如何删除记忆？

```bash
# 按 ID 删除
node scripts/memory_cli.js delete --id mem_xxx

# 批量归档过期记忆
node scripts/memory_cli.js archive --scope all --apply-decay --min-decay 0.15 --output archived.json

# 查看归档
node scripts/memory_cli.js list --status archived
```

→ 详见 [archive 命令](#archive--归档过期记忆衰减判据)

### Q15: 记忆太多检索变慢了怎么办？

1. 执行 `archive --scope all --apply-decay` 清理过期项
2. 执行 `merge` 合并相似记忆
3. `list --status archived` 检查归档，确认可物理清理的项用 `delete` 清除
4. 定期维护是例行工作，不是可选项

> 1000 条级记忆，算法检索 <20ms，端到端（含进程启动）<320ms。超万条才需要考虑迁移 SQLite。

→ 详见 [Maintenance](#maintenance)

### Q16: 能修改已存储的记忆吗？

能。使用 `update` 命令更新可见性、优先级、重要性等字段。

```bash
node scripts/memory_cli.js update --id mem_xxx --visibility shared --priority P1 --importance 0.9
```

→ 详见 [update 命令](#update--更新记忆可升级可见性)

---

## 排障

### Q17: 安装了 skill 但 Agent 不自动检索记忆？

可能的原因：

1. **skill 未被加载** — 用户话语未命中 frontmatter 触发词，skill 从未被激活。检查问题是否包含"之前/上次/记得/决策/方案"等触发词
2. **Agent 走了读文件路径** — 即使 skill 已加载，Agent 有时仍倾向于读项目文件而非调 CLI。这是 LLM 行为本能，SKILL.md 的强约束措辞（"不可绕过"）旨在压制此行为
3. **working memory 替代了记忆库** — Agent 把平台注入的 working memory 当作"已知"而跳过 search。注意：working memory 只是骨架，记忆库才是事实之源

→ 详见 [Agent 持续判断触发](#agent-持续判断触发触发权在-agent)

### Q18: 平台没有 Node.js 环境怎么办？

Agent 可直接读写 JSON 记忆文件——记忆库本质是 JSON，Agent 原生可理解。但需注意：

- **<100 条**：直读全文，语义判断最好
- **100-1000 条**：先读索引粗筛 + 再读候选条目精排
- **>1000 条**：必须用 CLI（直读全文已超出上下文窗口）

> 直读全文的 token 成本是 O(记忆总数)，CLI 检索是 O(top-N) 恒定。千条级差 ~200 倍。

→ 详见 [无 CLI 环境的降级路径](#无-cli-环境的降级路径可选agent-直读-json)

### Q19: 跨平台记忆互通吗？

**全局记忆库互通。** 所有平台共享同一个 `~/.memory-store/` 全局库——Claude Code 存的记忆，Gemini CLI 也能读到。但 skill 安装路径不同（`~/.claude/skills/`、`~/.gemini/skills/` 等）。

工作区记忆库 `.agents/memory-store/` 固定在项目目录下，跨平台路径一致。

→ 详见 [Supported Platforms](#supported-platforms)

### Q20: 记忆被误删了能恢复吗？

如果只是 `archive` 归档，记忆仍在 `archive/archived_YYYYMM.json` 中，可以手动恢复。如果是 `delete` 删除，目前无内置恢复机制——建议定期备份 `memories.json`。

---

## 安装与部署

### Q21: 如何安装？

```bash
# 推荐：npm 全局安装
npm install -g memory-store-skill

# 或：本地脚本安装（自动检测平台）
node scripts/install.js --all

# 或：手动复制
cp -r memory-store ~/.claude/skills/
```

安装后**新开会话**生效。

→ 详见 [安装部署](#4-安装部署)

### Q22: 如何发布到 npm？

```bash
# 1. 升级版本
npm version patch   # 1.0.2 → 1.0.3

# 2. 发布（需要 2FA OTP 验证码）
npm publish

# 3. 验证
npm view memory-store-skill
```

注意：npm 不允许覆盖已发布的版本号；unpublish 后 24 小时内不能重新发布任何版本；发布后 72 小时内可撤回。

---

## 还在困惑？

如果以上 FAQ 没有覆盖你的问题，欢迎：

- 提交 [GitHub Issue](https://github.com/Revolves/memory-store-skill/issues)
- 查阅 [SKILL.md](SKILL.md) 完整文档
- 参考 [示例记忆](examples/example_memories.json)