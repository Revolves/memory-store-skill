<p align="center">
  <h1 align="center">🧠 Memory Store Skill</h1>
  <p align="center">
    <strong>对话记忆存储、共享与检索 · Conversation Memory for AI Agents</strong>
  </p>
  <p align="center">
    <a href="README.zh.md">
      <img src="https://img.shields.io/badge/🇨🇳-中文文档-1a73e8?style=for-the-badge&logo=markdown" alt="中文文档">
    </a>
    &nbsp;&nbsp;
    <a href="README.en.md">
      <img src="https://img.shields.io/badge/🇬🇧-English Documentation-2ea44f?style=for-the-badge&logo=markdown" alt="English Documentation">
    </a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/version-v1.0.0-important?style=flat-square" alt="v1.0.0">
    <img src="https://img.shields.io/badge/platform-Claude_Code%20|%20Codex%20|%20Antigravity%20|%20OpenCode-8A2BE2?style=flat-square" alt="multi-platform">
    <img src="https://img.shields.io/badge/language-Node.js-339933?style=flat-square&logo=nodedotjs" alt="Node.js">
  </p>
</p>

---

## 选择语言 · Choose Language

| 语言 Language | 说明 | 入口 |
|---------------|------|------|
| 🇨🇳 **中文** | 面向中文用户，技能使用、安装部署、技术说明 | [→ 中文文档](README.zh.md) |
| 🇬🇧 **English** | For English-speaking users: usage, installation, technical docs | [→ English Docs](README.en.md) |

---

<div align="center">
  <a href="README.zh.md">
    <img src="https://img.shields.io/badge/📖-阅读中文文档-1a73e8?style=for-the-badge" alt="阅读中文文档">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="README.en.md">
    <img src="https://img.shields.io/badge/📖-Read English Docs-2ea44f?style=for-the-badge" alt="Read English Docs">
  </a>
</div>

---

## 快速预览 · Quick Preview

**Memory Store** 是一个轻量级对话记忆技能，为多 Agent 协作场景而生。

A lightweight conversation memory skill for multi-agent AI workflows.

| 能力 Capability | 中文 | English |
|-----------------|------|---------|
| 两层存储 | 全局（跨项目）+ 工作区（任务内） | global + workspace |
| 三层可见性 | private / shared / global | private / shared / global |
| 8 类记忆 | fact / decision / preference / workflow / debug_solution / state / event / relation | same |
| 触发方式 | Agent 对话中自主判断 | Agent-driven in-conversation |
| 检索算法 | 关键词 + 中文 n-gram + 艾宾浩斯衰减 | keyword + Chinese n-gram + Ebbinghaus decay |
| 性能 | 1000 条检索 <20ms 算法层 | <20ms algorithm at 1k entries |
| 安装 | `npm install -g memory-store-skill` | `npm install -g memory-store-skill` |

---

<sub>Memory Store Skill · 面向 AI Agent 工作场景的记忆管理 · Memory management for AI agent workflows</sub>