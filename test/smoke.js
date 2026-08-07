#!/usr/bin/env node
"use strict";

/**
 * Smoke test for memory_cli.js — exercises the core CLI surface against a
 * throwaway store directory. Run with: node test/smoke.js  (or npm test).
 *
 * No external deps: uses only Node built-ins.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const CLI = path.resolve(__dirname, "..", "scripts", "memory_cli.js");
const NODE = process.execPath;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "memory-smoke-"));
const STORE = path.join(TMP, "store");
const OUT = path.join(TMP, "out");
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
let failed = 0;

function run(args) {
  return execFileSync(NODE, [CLI, ...args], { encoding: "utf8" });
}

function runJson(args) {
  const out = path.join(OUT, `r_${Math.random().toString(36).slice(2)}.json`);
  run([...args, "--output", out]);
  return JSON.parse(fs.readFileSync(out, "utf8"));
}

function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`);
  }
}

try {
  // --- init ---------------------------------------------------------------
  run(["init", "--scope", "global", "--store-path", STORE]);
  check("init creates memories.json", fs.existsSync(path.join(STORE, "memories.json")));

  // --- store --------------------------------------------------------------
  run([
    "store", "--type", "decision", "--title", "DB selection",
    "--summary", "Chose SQLite over Postgres", "--tags", "db,arch",
    "--importance", "0.9", "--store-path", STORE,
  ]);
  run([
    "store", "--type", "debug_solution", "--title", "Null pointer fix",
    "--summary", "Guard against null in parse", "--tags", "bug",
    "--importance", "0.7", "--store-path", STORE,
  ]);

  // --- list ---------------------------------------------------------------
  const list = runJson(["list", "--scope", "global", "--store-path", STORE]);
  check("list returns 2 memories", Array.isArray(list) && list.length === 2, `got ${list && list.length}`);

  // --- search (english keyword) ------------------------------------------
  const search = runJson(["search", "--query", "SQLite", "--scope", "global", "--store-path", STORE]);
  check("search finds decision by keyword", search.length >= 1 && search[0].type === "decision", `got ${search.length}`);

  // --- search (chinese n-gram) -------------------------------------------
  const searchCn = runJson(["search", "--query", "选择 SQLite", "--scope", "global", "--store-path", STORE]);
  check("chinese n-gram search hits", searchCn.length >= 1);

  // --- recall (access count increments) ----------------------------------
  const firstId = list[0].id;
  const recalled = runJson(["recall", "--id", firstId, "--store-path", STORE]);
  check("recall returns memory + increments access", recalled.id === firstId && recalled.access_count === 1, `access=${recalled.access_count}`);

  // --- update -------------------------------------------------------------
  run(["update", "--id", firstId, "--visibility", "private", "--store-path", STORE]);
  const afterUpdate = runJson(["list", "--scope", "global", "--store-path", STORE]).find((m) => m.id === firstId);
  check("update changes visibility", afterUpdate && afterUpdate.visibility === "private");

  // --- visibility filter --------------------------------------------------
  const privOnly = runJson(["list", "--scope", "global", "--visibility", "private", "--store-path", STORE]);
  check("visibility filter works", privOnly.length === 1 && privOnly[0].id === firstId);

  // --- stats --------------------------------------------------------------
  const stats = runJson(["stats", "--scope", "global", "--store-path", STORE]);
  check("stats totals 2", stats.total_memories === 2, `got ${stats.total_memories}`);
  check("stats type breakdown present", stats.type_breakdown && stats.type_breakdown.decision === 1);

  // --- migrate dry-run (must not throw, returns numbers) ------------------
  const mig = runJson(["migrate", "--dry-run", "--store-path", STORE]);
  check("migrate dry-run runs", mig && typeof mig.total_now === "number" && mig.dry_run === true);

  // --- --stdout emits pure JSON (no "Success!" line) ---------------------
  const stdoutOut = run(["search", "--query", "SQLite", "--scope", "global", "--store-path", STORE, "--stdout"]);
  let stdoutOk = false;
  try { JSON.parse(stdoutOut); stdoutOk = !/Success!/.test(stdoutOut); } catch (e) { stdoutOk = false; }
  check("--stdout emits pure JSON (no Success! line)", stdoutOk);

  // --- --type multi-value ------------------------------------------------
  const multiType = runJson(["search", "--query", "", "--type", "decision,debug_solution", "--scope", "global", "--store-path", STORE]);
  check("--type multi-value returns both types", multiType.length === 2 && new Set(multiType.map((m) => m.type)).size === 2, `got ${multiType.length}`);

  // --- --type invalid -> non-zero exit -----------------------------------
  let typeErr = false;
  try {
    run(["search", "--query", "", "--type", "bogus", "--scope", "global", "--store-path", STORE, "--output", path.join(OUT, "x.json")]);
  } catch (e) {
    typeErr = e.status !== 0;
  }
  check("--type invalid exits non-zero", typeErr);

  // --- --output is a directory -> non-zero exit --------------------------
  const dirOut = path.join(OUT, "adir");
  fs.mkdirSync(dirOut);
  let dirErr = false;
  try {
    run(["list", "--scope", "global", "--store-path", STORE, "--output", dirOut]);
  } catch (e) {
    dirErr = e.status !== 0;
  }
  check("--output directory exits non-zero", dirErr);

  // --- compress generic chat format --------------------------------------
  const chatFile = path.join(OUT, "chat.jsonl");
  fs.writeFileSync(chatFile, JSON.stringify({ role: "user", content: "用什么数据库？" }) + "\n" + JSON.stringify({ role: "assistant", content: "用 SQLite" }) + "\n");
  const comp = runJson(["compress", "--input", chatFile]);
  check("compress generic-chat detected", comp.detected_format === "generic-chat" && comp.extracted_steps_count === 2, `fmt=${comp.detected_format}`);

  // --- archive (decay threshold removes low-value) — run last (destructive) ---
  run(["archive", "--scope", "global", "--apply-decay", "--min-decay", "1.0", "--store-path", STORE]);
  const afterArchive = runJson(["list", "--scope", "global", "--store-path", STORE]);
  check("archive removes by decay threshold", afterArchive.length < list.length, `remaining ${afterArchive.length}`);

  // --- version subcommand / -v flag --------------------------------------
  const verOut = run(["version"]).trim();
  check("version subcommand prints version", /^memory-store v\d+\.\d+\.\d+/.test(verOut), verOut);
  const verFlag = run(["-v"]).trim();
  check("-v flag prints version", /^memory-store v\d+\.\d+\.\d+/.test(verFlag), verFlag);

  // --- unknown command exits non-zero ------------------------------------
  let errored = false;
  try {
    run(["bogus-cmd"]);
  } catch (e) {
    errored = e.status !== 0;
  }
  check("unknown command exits non-zero", errored);
} catch (e) {
  failed++;
  console.error("FATAL:", e.stack || e.message);
}

console.log(`\nSmoke test: ${passed} passed, ${failed} failed`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
