#!/usr/bin/env node
/**
 * Post-install hook for npm package.
 *
 * Automatically runs after `npm install memory-store-skill`.
 * Detects AI agent platforms and installs the skill automatically.
 * No TTY required — uses non-interactive mode.
 */

const { execFileSync } = require("child_process");
const path = require("path");

const INSTALL_SCRIPT = path.resolve(__dirname, "install.js");

console.log("");
console.log("╔══════════════════════════════════════════════╗");
console.log("║     🧠 Memory Store Skill installed!         ║");
console.log("╚══════════════════════════════════════════════╝");
console.log("");

try {
  console.log("Scanning for AI agent platforms...");
  execFileSync(process.execPath, [INSTALL_SCRIPT, "--all"], {
    stdio: "inherit",
    timeout: 60000,
  });
} catch {
  console.log("No AI agent platforms detected, or installation was interrupted.");
  console.log("");
  console.log("You can install manually:");
  console.log("  memory-store-install --all");
  console.log("  memory-store-install --agent claude");
  console.log("  memory-store-update");
  console.log("");
  console.log("Or use the CLI directly:");
  console.log("  memory-store --help");
}
