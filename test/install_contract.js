#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const INSTALLER = path.join(ROOT, "scripts", "install.js");
const UPDATER = path.join(ROOT, "scripts", "update.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-store-install-contract-"));
const tempHome = path.join(tempRoot, "home");
const claudeConfig = path.join(tempRoot, "claude-config");
const codexConfig = path.join(tempRoot, "codex-config");
const manualTarget = path.join(tempRoot, "manual-target");
const dryRunTarget = path.join(tempRoot, "dry-run-target");

fs.mkdirSync(tempHome, { recursive: true });

const isolatedEnv = {
  ...process.env,
  HOME: tempHome,
  USERPROFILE: tempHome,
  CLAUDE_CONFIG_DIR: claudeConfig,
  CODEX_CONFIG_DIR: codexConfig,
};

function runNode(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: isolatedEnv,
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  assert.strictEqual(
    result.status,
    expectedStatus,
    `Expected exit ${expectedStatus}, got ${result.status}:\n${output}`
  );
  return output;
}

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertSame(relative, installedRoot) {
  const source = path.join(ROOT, relative);
  const installed = path.join(installedRoot, relative);
  assert.ok(fs.existsSync(installed), `Expected installed artifact: ${installed}`);
  assert.strictEqual(hash(installed), hash(source), `Artifact differs: ${relative}`);
}

try {
  assert.match(runNode([INSTALLER, "--unknown"], 1), /Unknown option/);
  assert.match(runNode([INSTALLER, "--target"], 1), /Missing value/);
  assert.match(runNode([INSTALLER, "--all", "--agent", "claude"], 1), /mutually exclusive/);
  assert.match(runNode([INSTALLER, "--check", "--dry-run", "--target", dryRunTarget], 1), /cannot be combined/);
  assert.match(runNode([INSTALLER, "--check", "--update", "--agent", "claude"], 1), /cannot be combined/);

  const dryRunOutput = runNode([INSTALLER, "--target", dryRunTarget, "--dry-run"]);
  assert.match(dryRunOutput, /Would copy and verify/);
  assert.ok(!fs.existsSync(dryRunTarget), "--dry-run must not create the target directory");
  assert.ok(!fs.existsSync(path.join(tempHome, ".memory-store")), "--dry-run must not initialize a memory store");

  const installOutput = runNode([INSTALLER, "--agent", "claude,codex"]);
  const claudeSkill = path.join(claudeConfig, "skills", "memory-store");
  const codexSkill = path.join(codexConfig, "skills", "memory-store");
  assert.match(installOutput, /Verified \d+ artifact\(s\)/);
  assert.ok(installOutput.includes(claudeSkill), "CLAUDE_CONFIG_DIR must determine the install target");
  assert.ok(installOutput.includes(codexSkill), "CODEX_CONFIG_DIR must determine the install target");

  for (const installedRoot of [claudeSkill, codexSkill]) {
    assertSame("SKILL.md", installedRoot);
    assertSame(path.join("scripts", "memory_cli.js"), installedRoot);
    assertSame(path.join("agents", "openai.yaml"), installedRoot);
    assertSame(path.join("references", "memory_schema.json"), installedRoot);
  }

  runNode([INSTALLER, "--check", "--agent", "claude,codex"]);

  fs.appendFileSync(path.join(claudeSkill, "SKILL.md"), "\ncontract-test-stale-copy\n", "utf8");
  const staleOutput = runNode([INSTALLER, "--check", "--agent", "claude"], 1);
  assert.match(staleOutput, /Changed: SKILL\.md/);
  const updateOutput = runNode([INSTALLER, "--update", "--agent", "claude"]);
  assert.match(updateOutput, /Updating 1 existing target/);
  assert.match(updateOutput, /1 target\(s\) changed/);
  runNode([INSTALLER, "--check", "--agent", "claude"]);

  const currentOutput = runNode([INSTALLER, "--update", "--agent", "claude"]);
  assert.match(currentOutput, /Already current/);
  assert.match(currentOutput, /0 target\(s\) changed/);

  const missingUpdateTarget = path.join(tempRoot, "missing-update-target");
  assert.match(runNode([INSTALLER, "--update", "--target", missingUpdateTarget], 1), /no existing installation/);
  assert.ok(!fs.existsSync(missingUpdateTarget), "--update must not create a new installation");

  fs.appendFileSync(path.join(codexSkill, "SKILL.md"), "\ncontract-test-updater-copy\n", "utf8");
  const updaterPreview = runNode([UPDATER, "--source", ROOT, "--agent", "codex", "--dry-run"]);
  assert.match(updaterPreview, /1 target\(s\) need update/);
  assert.notStrictEqual(
    hash(path.join(codexSkill, "SKILL.md")),
    hash(path.join(ROOT, "SKILL.md")),
    "updater --dry-run must not change installed files"
  );
  const updaterOutput = runNode([UPDATER, "--source", ROOT, "--agent", "codex"]);
  assert.match(updaterOutput, /Updating from memory-store-skill v/);
  runNode([INSTALLER, "--check", "--agent", "codex"]);

  runNode([INSTALLER, "--target", manualTarget]);
  runNode([INSTALLER, "--check", "--target", manualTarget]);
  assertSame("SKILL.md", manualTarget);
  assertSame(path.join("scripts", "memory_cli.js"), manualTarget);

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.strictEqual(pkg.bin["memory-store-update"], "scripts/update.js");
  assert.ok(pkg.files.includes("scripts/update.js"), "package files must include scripts/update.js");
  for (const directory of ["agents", "examples", "references"]) {
    assert.ok(pkg.files.includes(directory), `package files must include ${directory}/`);
  }
  assert.match(pkg.scripts.test, /install_contract\.js/);

  const postinstall = fs.readFileSync(path.join(ROOT, "scripts", "postinstall.js"), "utf8");
  assert.match(postinstall, /execFileSync\(process\.execPath,/);
  assert.doesNotMatch(postinstall, /\bexecSync\s*\(/);

  const versionOutput = runNode([path.join(manualTarget, "scripts", "memory_cli.js"), "version"]);
  assert.ok(versionOutput.includes(`v${pkg.version}`), "installed CLI version must match package.json");

  console.log("Install contract tests passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
