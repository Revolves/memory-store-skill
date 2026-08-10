#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const PACKAGE_NAME = "memory-store-skill";

function fail(message) {
  console.error(`Update failed: ${message}`);
  process.exitCode = 1;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} exited with status ${result.status}`);
  }
}

function npmCommand() {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    return { command: process.execPath, prefix: [process.env.npm_execpath] };
  }

  const adjacent = path.join(
    path.dirname(process.execPath),
    process.platform === "win32" ? "npm.cmd" : "npm"
  );
  if (fs.existsSync(adjacent)) return { command: adjacent, prefix: [] };
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", prefix: [] };
}

function validateSource(sourceDir) {
  const root = path.resolve(sourceDir);
  const manifest = path.join(root, "package.json");
  const installer = path.join(root, "scripts", "install.js");
  if (!fs.existsSync(manifest) || !fs.existsSync(installer)) {
    throw new Error(`invalid update source: ${root}`);
  }
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  if (pkg.name !== PACKAGE_NAME) {
    throw new Error(`update source is '${pkg.name || "unknown"}', expected '${PACKAGE_NAME}'`);
  }
  return { root, installer, version: pkg.version || "unknown" };
}

function parseArgs(args) {
  const flags = { help: false, dryRun: false, all: false, agents: null, target: null, source: null };
  const booleanOptions = new Set(["--help", "-h", "--dry-run", "--all"]);
  const valuedOptions = new Set(["--agent", "--target", "--source"]);

  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (booleanOptions.has(option)) {
      if (option === "--help" || option === "-h") flags.help = true;
      else if (option === "--dry-run") flags.dryRun = true;
      else if (option === "--all") flags.all = true;
      continue;
    }
    if (!valuedOptions.has(option)) {
      throw new Error(`unknown option '${option}'`);
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for ${option}`);
    }
    if (option === "--agent") flags.agents = value;
    else if (option === "--target") flags.target = value;
    else flags.source = value;
    i++;
  }

  const selectors = Number(flags.all) + Number(Boolean(flags.agents)) + Number(Boolean(flags.target));
  if (selectors > 1) throw new Error("--all, --agent, and --target are mutually exclusive selectors");
  return flags;
}

function printHelp() {
  console.log(`
Memory Store Skill Updater

Usage:
  memory-store-update                  Download npm latest and update detected installations
  memory-store-update --agent codex    Update one or more installed platforms
  memory-store-update --target <path>  Update an existing custom installation
  memory-store-update --all            Update all detected existing installations
  memory-store-update --dry-run        Download and preview without changing installations
  memory-store-update --source <path>  Update from a local package source instead of npm

The updater downloads ${PACKAGE_NAME}@latest with lifecycle scripts disabled, updates only
existing skill installations, verifies copied artifacts, and leaves memory data unchanged.
`);
}

function installerArgs(flags) {
  const args = ["--update"];
  if (flags.all) args.push("--all");
  if (flags.agents) args.push("--agent", flags.agents);
  if (flags.target) args.push("--target", flags.target);
  if (flags.dryRun) args.push("--dry-run");
  return args;
}

function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`${error.message}. Run with --help for usage.`);
    return;
  }
  if (flags.help) {
    printHelp();
    return;
  }

  let tempRoot = null;
  try {
    let source;
    if (flags.source) {
      source = validateSource(flags.source);
    } else {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-store-update-"));
      const npm = npmCommand();
      console.log(`Downloading ${PACKAGE_NAME}@latest from npm...`);
      run(npm.command, [
        ...npm.prefix,
        "install",
        "--prefix", tempRoot,
        `${PACKAGE_NAME}@latest`,
        "--ignore-scripts",
        "--no-save",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
      ]);
      source = validateSource(path.join(tempRoot, "node_modules", PACKAGE_NAME));
    }

    console.log(`Updating from ${PACKAGE_NAME} v${source.version}...`);
    run(process.execPath, [source.installer, ...installerArgs(flags)]);
  } catch (error) {
    fail(error.message);
  } finally {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
