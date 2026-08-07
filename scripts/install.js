#!/usr/bin/env node
/**
 * memory-store skill installer — interactive
 *
 * One-command install from git repo. Two modes:
 *   1. Standard — scan home directory for supported AI agents, list them, let user choose
 *   2. Manual  — user specifies the target directory path
 *
 * Usage:
 *   node scripts/install.js                  Interactive: choose mode → select targets → install
 *   node scripts/install.js --all            Non-interactive: install to ALL detected agents
 *   node scripts/install.js --agent claude   Non-interactive: install to specific agent(s)
 *   node scripts/install.js --list           Just list detected agents
 *   node scripts/install.js --help           Show help
 *
 * Detected platforms:
 *   claude, codex, gemini, opencode, workbuddy, cursor, windsurf, qoderworkcn, trae-cn
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

// =============================================================================
// Agent platform definitions
// =============================================================================

const AGENT_PLATFORMS = [
  {
    name: "claude",
    label: "Claude Code",
    skillDir: path.join(os.homedir(), ".claude", "skills", "memory-store"),
    detect: () =>
      process.env.CLAUDE_CONFIG_DIR ||
      fs.existsSync(path.join(os.homedir(), ".claude")),
  },
  {
    name: "codex",
    label: "Codex",
    skillDir: path.join(os.homedir(), ".agents", "skills", "memory-store"),
    detect: () =>
      process.env.CODEX_CONFIG_DIR ||
      fs.existsSync(path.join(os.homedir(), ".agents")),
  },
  {
    name: "gemini",
    label: "Gemini CLI",
    skillDir: path.join(os.homedir(), ".gemini", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".gemini")),
  },
  {
    name: "opencode",
    label: "OpenCode",
    skillDir: path.join(os.homedir(), ".config", "opencode", "skills", "memory-store"),
    detect: () =>
      fs.existsSync(path.join(os.homedir(), ".config", "opencode")),
  },
  {
    name: "workbuddy",
    label: "WorkBuddy / Antigravity",
    skillDir: path.join(os.homedir(), ".workbuddy", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".workbuddy")),
  },
  {
    name: "cursor",
    label: "Cursor",
    skillDir: path.join(os.homedir(), ".cursor", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".cursor")),
  },
  {
    name: "windsurf",
    label: "Windsurf",
    skillDir: path.join(os.homedir(), ".windsurf", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".windsurf")),
  },
  {
    name: "qoderworkcn",
    label: "QoderWorkCN",
    skillDir: path.join(os.homedir(), ".qoderworkcn", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".qoderworkcn")),
  },
  {
    name: "trae-cn",
    label: "Trae CN",
    skillDir: path.join(os.homedir(), ".trae-cn", "skills", "memory-store"),
    detect: () => fs.existsSync(path.join(os.homedir(), ".trae-cn")),
  },
];

// =============================================================================
// Helpers
// =============================================================================

const SKILL_DIR = path.resolve(__dirname, "..");

function copyDir(src, dst, filter = () => true) {
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(src)) {
    if (!filter(name)) continue;
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) {
      count += copyDir(s, d, filter);
    } else {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

function detectAgents() {
  const found = [];
  for (const agent of AGENT_PLATFORMS) {
    try {
      if (agent.detect()) {
        found.push({ ...agent, installed: fs.existsSync(agent.skillDir) });
      }
    } catch {
      // skip if detection throws
    }
  }
  return found;
}

function installTo(targetDir) {
  const dst = path.resolve(targetDir);
  console.log(`  📁 Installing to: ${dst}`);

  // Create directory structure
  fs.mkdirSync(dst, { recursive: true });
  fs.mkdirSync(path.join(dst, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dst, "references"), { recursive: true });
  fs.mkdirSync(path.join(dst, "examples"), { recursive: true });

  // Copy SKILL.md
  const skillSrc = path.join(SKILL_DIR, "SKILL.md");
  if (fs.existsSync(skillSrc)) {
    fs.copyFileSync(skillSrc, path.join(dst, "SKILL.md"));
    console.log(`    ✅ SKILL.md`);
  }

  // Copy scripts/ (only .js files)
  const scriptSrc = path.join(SKILL_DIR, "scripts");
  if (fs.existsSync(scriptSrc)) {
    const n = copyDir(scriptSrc, path.join(dst, "scripts"), (name) =>
      name.endsWith(".js")
    );
    console.log(`    ✅ scripts/ (${n} files)`);
  }

  // Copy references/
  const refSrc = path.join(SKILL_DIR, "references");
  if (fs.existsSync(refSrc)) {
    const n = copyDir(refSrc, path.join(dst, "references"));
    console.log(`    ✅ references/ (${n} files)`);
  }

  // Copy examples/
  const exSrc = path.join(SKILL_DIR, "examples");
  if (fs.existsSync(exSrc)) {
    const n = copyDir(exSrc, path.join(dst, "examples"));
    console.log(`    ✅ examples/ (${n} files)`);
  }

  return true;
}

function initUniversalGlobalStore() {
  const storeDir = path.join(os.homedir(), ".memory-store");
  const memFile = path.join(storeDir, "memories.json");
  if (!fs.existsSync(memFile)) {
    fs.mkdirSync(storeDir, { recursive: true });
    fs.writeFileSync(memFile, "[]", "utf-8");
    fs.writeFileSync(path.join(storeDir, "memories.index.json"), "{}", "utf-8");
    console.log(`    ✅ Initialized universal global store: ${storeDir}`);
  } else {
    console.log(`    ⏭️  Universal global store already exists: ${storeDir}`);
  }
}

// =============================================================================
// Interactive helpers
// =============================================================================

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════╗
║        🧠 Memory Store Skill Installer       ║
║   Conversation memory for multi-agent AI     ║
╚══════════════════════════════════════════════╝
`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const flags = {
    list: args.includes("--list"),
    all: args.includes("--all"),
    help: args.includes("--help") || args.includes("-h"),
    agents: [],
  };

  // Parse --agent values
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flags.agents.push(...args[i + 1].split(",").map((a) => a.trim().toLowerCase()));
    }
  }

  if (flags.help) {
    console.log(`
Memory Store Skill Installer — One-command install

Usage:
  node scripts/install.js                    Interactive: choose mode → select targets → install
  node scripts/install.js --all              Install to ALL detected agents (non-interactive)
  node scripts/install.js --agent claude     Install to specific agent(s) (non-interactive)
  node scripts/install.js --list             List detected agents only
  node scripts/install.js --help             Show this help

Detected platforms:
  claude      — Claude Code
  codex       — Codex
  gemini      — Gemini CLI
  opencode    — OpenCode
  workbuddy   — WorkBuddy / Antigravity
  cursor      — Cursor
  windsurf    — Windsurf
  qoderworkcn — QoderWorkCN
  trae-cn     — Trae CN
`);
    process.exit(0);
  }

  // --- Detect agents ---
  const found = detectAgents();

  // --- Non-interactive modes ---
  if (flags.list) {
    printBanner();
    if (found.length === 0) {
      console.log("No AI agent platforms detected on this system.\n");
    } else {
      console.log(`Detected ${found.length} AI agent platform(s):\n`);
      for (const agent of found) {
        const status = agent.installed ? "📦 installed" : "🆕 available";
        console.log(`  ${agent.label.padEnd(22)} ${status}`);
        console.log(`    ${agent.skillDir}`);
      }
    }
    process.exit(0);
  }

  if (flags.all) {
    // Non-interactive: install to all detected
    printBanner();
    if (found.length === 0) {
      console.log("No AI agent platforms detected. Nothing to install.");
      process.exit(1);
    }
    console.log(`🔍 Detected ${found.length} agent(s). Installing to ALL...\n`);
    let successCount = 0;
    for (const agent of found) {
      try {
        installTo(agent.skillDir);
        successCount++;
      } catch (e) {
        console.error(`    ❌ ${agent.label}: ${e.message}`);
      }
    }
    initUniversalGlobalStore();
    console.log(`\n✅ Installation complete (${successCount}/${found.length}).`);
    if (successCount > 0) console.log("   Restart your agent sessions for the skill to take effect.");
    process.exit(0);
  }

  if (flags.agents.length > 0) {
    // Non-interactive: install to specified agents
    printBanner();
    if (found.length === 0) {
      console.log("No AI agent platforms detected. Nothing to install.");
      process.exit(1);
    }
    console.log(`🔍 Installing to specified agent(s): ${flags.agents.join(", ")}\n`);
    let successCount = 0;
    for (const name of flags.agents) {
      const agent = found.find((a) => a.name === name);
      if (agent) {
        try {
          installTo(agent.skillDir);
          successCount++;
        } catch (e) {
          console.error(`    ❌ ${agent.label}: ${e.message}`);
        }
      } else {
        console.warn(`  ⚠️  Agent "${name}" not found. Available: ${found.map((a) => a.name).join(", ")}`);
      }
    }
    initUniversalGlobalStore();
    console.log(`\n✅ Installation complete (${successCount}/${flags.agents.length}).`);
    if (successCount > 0) console.log("   Restart your agent sessions for the skill to take effect.");
    process.exit(0);
  }

  // =========================================================================
  // Interactive mode
  // =========================================================================
  printBanner();

  console.log("This installer will copy the Memory Store skill to your AI agent platform(s).\n");

  // --- Step 1: Choose installation mode ---
  console.log("─── Installation Mode ───");
  console.log("  1. Standard — Scan home directory, select agents to install");
  console.log("  2. Manual  — Specify target directory path");
  const modeAnswer = await ask("\nChoose [1/2] (default: 1): ");
  const isManual = modeAnswer === "2";

  let targets = []; // Array of { agent, dir }

  if (isManual) {
    // --- Manual mode ---
    console.log("\n─── Manual Install ───");
    const manualPath = await ask("Target path: ");
    if (!manualPath) {
      console.log("❌ Path is required. Aborting.");
      process.exit(1);
    }
    const resolvedPath = path.resolve(manualPath);
    console.log(`\n  Path: ${resolvedPath}`);

    // Check if path exists or create
    if (!fs.existsSync(resolvedPath)) {
      const create = await ask("  Path does not exist. Create? [y/N] (default: N): ");
      if (create.toLowerCase() === "y") {
        fs.mkdirSync(resolvedPath, { recursive: true });
        console.log("  ✅ Directory created.");
      } else {
        console.log("❌ Aborting.");
        process.exit(1);
      }
    }

    targets.push({ agent: { name: "manual", label: "Manual", skillDir: resolvedPath }, dir: resolvedPath });
  } else {
    // --- Standard mode ---
    console.log("\n─── Scanning System ───");

    if (found.length === 0) {
      console.log("  ⚠️  No AI agent platforms detected on this system.");
      console.log("  Switching to manual mode. Please specify the target path.\n");
      const manualPath = await ask("Target path: ");
      if (!manualPath) {
        console.log("❌ Aborting.");
        process.exit(1);
      }
      const resolvedPath = path.resolve(manualPath);
      if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
      }
      targets.push({ agent: { name: "manual", label: "Manual", skillDir: resolvedPath }, dir: resolvedPath });
    } else {
      console.log(`  Found ${found.length} AI agent platform(s):\n`);
      for (let i = 0; i < found.length; i++) {
        const agent = found[i];
        const status = agent.installed ? "📦 installed" : "🆕 available";
        console.log(`  ${(i + 1).toString().padEnd(3)} ${agent.label.padEnd(22)} ${status}`);
        console.log(`      ${agent.skillDir}`);
      }

      console.log("\n  Select targets:");
      console.log("  - Enter numbers (e.g. 1,3,5) to select specific agents");
      console.log("  - Enter 'all' to install to all agents");
      console.log("  - Enter '0' to switch to manual mode");
      const selection = await ask("\nYour choice: ");

      if (selection.toLowerCase() === "all") {
        targets = found.map((a) => ({ agent: a, dir: a.skillDir }));
      } else if (selection === "0") {
        // Switch to manual
        const manualPath = await ask("Target path: ");
        if (manualPath) {
          const resolvedPath = path.resolve(manualPath);
          if (!fs.existsSync(resolvedPath)) {
            fs.mkdirSync(resolvedPath, { recursive: true });
          }
          targets.push({ agent: { name: "manual", label: "Manual", skillDir: resolvedPath }, dir: resolvedPath });
        }
      } else {
        const indices = selection
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= found.length);
        for (const idx of indices) {
          const agent = found[idx - 1];
          targets.push({ agent, dir: agent.skillDir });
        }
      }
    }
  }

  if (targets.length === 0) {
    console.log("\n❌ No targets selected. Aborting.");
    process.exit(1);
  }

  // --- Step 2: Confirm targets ---
  console.log("\n─── Target Summary ───");
  for (const { agent } of targets) {
    console.log(`  📦 ${agent.label.padEnd(22)} → ${agent.dir}`);
  }

  // --- Step 3: Confirm ---

  // --- Step 5: Confirm and execute ---
  const confirm = await ask("\nProceed with installation? [Y/n] (default: Y): ");
  if (confirm.toLowerCase() === "n") {
    console.log("❌ Installation cancelled.");
    process.exit(0);
  }

  console.log("\n─── Installing ───\n");

  let successCount = 0;
  for (const { agent, dir } of targets) {
    try {
      const ok = installTo(dir);
      if (ok) {
        successCount++;
      }
    } catch (e) {
      console.error(`    ❌ ${agent.label}: ${e.message}`);
    }
  }

  // --- Summary ---
  initUniversalGlobalStore();
  console.log(`\n✅ Installation complete (${successCount}/${targets.length} targets).`);
  if (successCount > 0) {
    console.log("   Restart your agent sessions for the skill to take effect.");
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});