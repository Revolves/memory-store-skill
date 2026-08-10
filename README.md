<p align="center">
  <h1 align="center">🧠 Memory Store Skill</h1>
  <p align="center"><strong>跨会话、多 Agent 的结构化记忆 · Structured memory for AI agents</strong></p>
  <p align="center">
    <a href="README.zh.md">中文文档</a> · <a href="README.en.md">English docs</a>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/memory-store-skill"><img src="https://img.shields.io/npm/v/memory-store-skill?style=flat-square&logo=npm" alt="npm version"></a>
    <img src="https://img.shields.io/badge/runtime-Node.js%2018%2B-339933?style=flat-square&logo=nodedotjs" alt="Node.js 18+">
    <img src="https://img.shields.io/badge/dependencies-zero-2ea44f?style=flat-square" alt="zero runtime dependencies">
  </p>
</p>

Memory Store 是一个轻量级 Agent skill：Agent 负责判断什么值得记、何时检索，纯 Node.js CLI 负责校验、存储、过滤、排序和归档。

Memory Store is a lightweight agent skill. The agent decides what is worth remembering and when history is relevant; a zero-dependency Node.js CLI handles validation, persistence, filtering, ranking, and archiving.

## Install · 安装

Requires Node.js 18+ · 需要 Node.js 18+

```bash
npm i memory-store-skill
```

The npm installer automatically detects supported Agent platforms and installs the skill. Start a new Agent session after installation.

npm 安装器会自动检测支持的 Agent 平台并安装 skill。安装完成后，请新开一个 Agent 会话。

```bash
# Verify · 验证
npx memory-store version

# Select a platform manually · 手动指定平台
npx memory-store-install --list
npx memory-store-install --agent codex
```

## Update · 更新

```bash
npx memory-store-update
```

This downloads npm `latest`, updates only existing skill installations, verifies the result, and leaves memory data unchanged.

该命令会下载 npm `latest`，只更新已有的 skill 安装并完成校验，不会修改记忆数据。

```bash
# Preview or update one platform · 预览或指定平台
npx memory-store-update --dry-run
npx memory-store-update --agent codex
```

| Capability | 说明 / Description |
|---|---|
| Two scopes | 全局 `global` + 项目 `workspace` |
| Visibility labels | `private` / `shared` / `global` cooperative filtering |
| Eight memory types | fact, decision, preference, workflow, debug_solution, state, event, relation |
| Retrieval | keyword, tags, type, freshness, importance, and Chinese n-grams |
| Lifecycle | TTL, priority-aware decay, archive, restore, merge |
| Runtime | Node.js 18+, no third-party runtime dependencies, no daemon |

> `private` is not encryption or an operating-system security boundary. Do not store credentials, tokens, keys, or raw personal data.

## Start here

- [中文：完整说明与 5 分钟上手](README.zh.md)
- [English: full guide and quick start](README.en.md)
- [CLI 速查表](CHEATSHEET.md)
- [常见问题](FAQ.md)
- [Agent 指令](SKILL.md)

需要从源码安装或参与开发时：

```bash
git clone https://github.com/Revolves/memory-store-skill.git
cd memory-store-skill
node scripts/install.js --all
```

## License

MIT.
