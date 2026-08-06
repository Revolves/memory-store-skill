#!/usr/bin/env node
/**
 * Post-install hook for npm package.
 *
 * Automatically runs after `npm install -g memory-store-skill`.
 * - Interactive (TTY): auto-detects agents and installs with confirmation
 * - Non-interactive: prints instructions
 */

const { execSync } = require("child_process");
const path = require("path");

const INSTALL_SCRIPT = path.resolve(__dirname, "install.js");
const isTTY = process.stdout.isTTY && process.stdin.isTTY;

console.log("");
console.log("╔══════════════════════════════════════════════╗");
console.log("║     🧠 Memory Store Skill installed!         ║");
console.log("╚══════════════════════════════════════════════╝");
console.log("");

if (isTTY) {
  console.log("Scanning for AI agent platforms...");
  try {
    // Show detected agents first
    execSync(`node "${INSTALL_SCRIPT}" --list`, { stdio: "inherit" });
    console.log("");
    console.log("Install to the detected agents?");
    // Run interactive installer
    execSync(`node "${INSTALL_SCRIPT}"`, { stdio: "inherit" });
  } catch (e) {
    // If installer fails, show manual instructions
    console.log("\nInstallation interrupted. You can run manually:");
    console.log("  memory-store-install --all");
    process.exit(0);
  }
} else {
  console.log("Install to AI agents by running:");
  console.log("");
  console.log("  memory-store-install --all");
  console.log("  memory-store-install --agent claude");
  console.log("");
  console.log("Or use the CLI directly to manage memories:");
  console.log("  memory-store --help");
  console.log("");
}