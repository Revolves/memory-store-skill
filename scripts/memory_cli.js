#!/usr/bin/env node
/**
 * Memory Store CLI Utility — Node.js edition
 *
 * Pure Node built-ins (fs/path/os/crypto/process), zero dependencies.
 * Feature-parity with the Python edition: two-layer store (global/workspace),
 * three-tier visibility (private/shared/global), atomic writes, decay archive,
 * Chinese n-gram retrieval. JSON files are the single source of truth.
 *
 * Usage: memory-store <command> [--key value ...]
 *        node scripts/memory_cli.js <command> [--key value ...]
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// ==============================================================================
// Constants & defaults
// ==============================================================================

const VALID_TYPES = ["workflow", "decision", "fact", "preference", "debug_solution", "state", "event", "relation"];
const VISIBILITIES = ["private", "shared", "global"];
const PRIORITIES = ["P1", "P2", "P3"];
const SCHEMA_VERSION = 2;
const DEFAULT_VISIBILITY = { global: "global", project: "shared", workspace: "shared" };
const PRIORITY_DECAY = { P1: 0.3, P2: 0.5, P3: 0.8 };
const PROJECT_STORE_RELATIVE = path.join(".agents", "memory-store");

// Authoritative fallback version. MUST match package.json "version".
// Used when package.json is not present (e.g. deployed skill dir without it).
const VERSION = "1.0.2";

// Legacy platform-specific global stores (pre-v2.8). Used only by `migrate`
// to discover and consolidate memories into the universal store.
const LEGACY_GLOBAL_STORES = {
  claude: path.join(os.homedir(), ".claude", "memory-store"),
  gemini: path.join(os.homedir(), ".gemini", "memory-store"),
  antigravity: path.join(os.homedir(), ".gemini", "config", "memory-store"),
  codex: path.join(os.homedir(), ".agents", "memory-store"),
  opencode: path.join(os.homedir(), ".config", "opencode", "memory-store"),
};

/** Universal global store path — shared across all agent platforms. */
const UNIVERSAL_GLOBAL_STORE = path.join(os.homedir(), ".memory-store");

/** Type icons for SUMMARY.md display. */
const TYPE_ICON = {
  decision: "📐", debug_solution: "🔧", workflow: "🔄",
  preference: "⭐", fact: "📌", state: "📊", event: "📅", relation: "🔗",
};

// ==============================================================================
// Helpers
// ==============================================================================

function nowISO() {
  return new Date().toISOString();
}

function generateId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = crypto.randomBytes(3).toString("hex").slice(0, 6);
  return `mem_${dateStr}_${rand}`;
}

function normalizeScope(scope) {
  return scope === "project" ? "workspace" : scope;
}

function inferPriority(imp) {
  return imp >= 0.8 ? "P1" : imp >= 0.5 ? "P2" : "P3";
}

/** Normalized signature for dedup: type + title + leading summary. */
function memSignature(m) {
  const norm = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  return `${m.type || "fact"}|${norm(m.title)}|${norm(m.summary).slice(0, 80)}`;
}

/** Parse --type (comma-separated, multi-value) into a validated Set, or null if absent. */
function parseTypeFilter(typeArg) {
  if (!typeArg) return null;
  const types = typeArg.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!types.length) return null;
  const invalid = types.filter((t) => !VALID_TYPES.includes(t));
  if (invalid.length) {
    process.stderr.write(
      `Error: Invalid memory type(s): ${invalid.join(", ")}. Must be one of: ${VALID_TYPES.join(", ")}\n`
    );
    process.exit(1);
  }
  return new Set(types);
}

/** Read-time normalization: fill v2 fields with defaults (back-compat). */
function defaults(mem, storeScope) {
  const scope = normalizeScope(storeScope || "global");
  const imp = parseFloat(mem.importance ?? 0.5);
  const defs = {
    schema_version: SCHEMA_VERSION,
    scope: scope,
    visibility: DEFAULT_VISIBILITY[scope] || "shared",
    priority: inferPriority(imp),
    status: "active",
    decay_score: imp,
    owner_agent: null,
    embedding: null,
    embedding_model: null,
  };
  for (const [k, v] of Object.entries(defs)) {
    if (mem[k] === undefined || mem[k] === null) mem[k] = v;
  }
  return mem;
}

function detectDefaultStorePath(scope) {
  if (scope === "project" || scope === "workspace") {
    return path.resolve(process.cwd(), PROJECT_STORE_RELATIVE);
  }
  // Universal global store: shared across all agent platforms
  // Always use this path — it's the single source of truth for global memories.
  // Platform-specific paths are only consulted as fallback during migration.
  return path.resolve(UNIVERSAL_GLOBAL_STORE);
}

function resolveStorePath(overridePath, scope) {
  if (overridePath) return path.resolve(overridePath);
  return detectDefaultStorePath(scope);
}

/** Multi-layer path resolution; scope=all + storePath treats it as ROOT (with v1 fallback). */
function resolveTargetPaths(storePathArg, scope) {
  const paths = [];
  const useRoot = Boolean(storePathArg) && scope === "all";
  if (scope === "all" || scope === "global") {
    if (useRoot) {
      const root = path.resolve(storePathArg);
      paths.push(["global", path.join(root, "global")]);
      if (fs.existsSync(path.join(root, "memories.json"))) paths.push(["global", root]);
    } else {
      paths.push(["global", resolveStorePath(storePathArg, "global")]);
    }
  }
  if (scope === "all" || scope === "project" || scope === "workspace") {
    if (useRoot) {
      const root = path.resolve(storePathArg);
      paths.push(["workspace", path.join(root, "workspace")]);
      if (fs.existsSync(path.join(root, "memories.json"))) paths.push(["workspace", root]);
    } else {
      paths.push(["workspace", resolveStorePath(storePathArg, "project")]);
    }
  }
  return paths;
}

function ensureStoreDir(storePath) {
  fs.mkdirSync(storePath, { recursive: true });
  fs.mkdirSync(path.join(storePath, "archive"), { recursive: true });
  const memFile = path.join(storePath, "memories.json");
  if (!fs.existsSync(memFile)) fs.writeFileSync(memFile, "[]\n", "utf8");
  const idxFile = path.join(storePath, "memories.index.json");
  if (!fs.existsSync(idxFile)) fs.writeFileSync(idxFile, "{}\n", "utf8");
}

function loadMemories(storePath) {
  const memFile = path.join(storePath, "memories.json");
  if (!fs.existsSync(memFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(memFile, "utf8"));
  } catch (e) {
    process.stderr.write(`Error reading memories from ${memFile}: ${e.message}\n`);
    return [];
  }
}

/** Atomic write: temp file + rename (crash-safe, multi-agent safe). */
function atomicWriteJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function saveMemories(storePath, memories) {
  ensureStoreDir(storePath);
  const memFile = path.join(storePath, "memories.json");
  atomicWriteJson(memFile, memories);
  rebuildIndex(storePath, memories);
  updateSummary(storePath, memories);
}

/** Compute a composite score for summary ranking: importance × recency boost. */
function summaryScore(mem) {
  const imp = parseFloat(mem.importance || 0.5);
  let recency = 1.0;
  if (mem.created_at) {
    const days = (Date.now() - new Date(mem.created_at).getTime()) / 86400000;
    recency = Math.exp(-0.02 * days); // gentle decay over ~50 days
  }
  return imp * recency;
}

/** Maintain SUMMARY.md — a human/agent-readable snapshot of top memories. */
function updateSummary(storePath, memories) {
  if (!memories || memories.length === 0) {
    fs.writeFileSync(path.join(storePath, "SUMMARY.md"),
      "# Memory Store Summary\n\n_No memories yet._\n", "utf8");
    return;
  }

  // Rank: composite score descending, take top 10
  const ranked = memories
    .filter((m) => m.status !== "archived")
    .map((m) => ({ mem: m, score: summaryScore(m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const lines = [];
  lines.push("# Memory Store Summary\n");
  lines.push(`_Last updated: ${nowISO()}_\n`);
  lines.push(`Total memories: ${memories.length} | Showing top ${ranked.length}\n`);
  lines.push("---\n");

  for (const { mem, score } of ranked) {
    const icon = TYPE_ICON[mem.type] || "📄";
    const p = mem.priority || "P2";
    const imp = mem.importance || "—";
    const scope = mem.scope === "workspace" ? "📁" : "🌐";
    lines.push(`### ${icon} ${mem.type}: ${mem.title}`);
    lines.push(`**Priority:** ${p} · **Importance:** ${imp} · **Scope:** ${scope} ${mem.scope || "global"}`);
    if (mem.summary) lines.push(mem.summary);
    if (mem.tags && mem.tags.length) lines.push(`\`tags: ${mem.tags.join(", ")}\``);
    lines.push("");
  }

  lines.push("---\n");
  lines.push("_Run `memory-store search --query \"...\"` for full-text search._\n");

  fs.writeFileSync(path.join(storePath, "SUMMARY.md"), lines.join("\n"), "utf8");
}

function rebuildIndex(storePath, memories) {
  const index = {};
  for (const mem of memories) {
    const text = `${mem.title || ""} ${mem.summary || ""} ${mem.details || ""} ${(mem.tags || []).join(" ")}`.toLowerCase();
    const tokens = new Set(text.match(/[\w\u4e00-\u9fff]+/g) || []);
    for (const t of tokens) {
      if (t.length >= 2) {
        if (!index[t]) index[t] = [];
        index[t].push(mem.id);
      }
    }
  }
  fs.writeFileSync(path.join(storePath, "memories.index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
}

function writeOutput(data, outputFile) {
  const json = JSON.stringify(data, null, 2) + "\n";
  if (!outputFile) {
    process.stdout.write(json);
    return;
  }
  const out = path.resolve(outputFile);
  try {
    const st = fs.existsSync(out) ? fs.statSync(out) : null;
    if (st && st.isDirectory()) {
      process.stderr.write(`Error: --output path is a directory, not a file: ${out}\n`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json, "utf8");
  } catch (e) {
    process.stderr.write(`Error: Cannot write output to '${out}': ${e.message}\n`);
    process.exit(1);
  }
  process.stdout.write(`Success! Output written to: ${out}\n`);
}

// ==============================================================================
// Search & scoring (incl. Chinese n-gram windows)
// ==============================================================================

const CN_RUN = /[\u4e00-\u9fff]+/;

/** Splits a query into [origToken, [cnNGrams]] units for substring scoring. */
function expandQueryUnits(query) {
  const units = [];
  for (const tok of query.split(/\s+/)) {
    if (!tok) continue;
    const cnRuns = tok.match(CN_RUN) || [];
    if (cnRuns.length) {
      const grams = [];
      for (const run of cnRuns) {
        if (run.length >= 3) {
          for (const n of [4, 3, 2]) {
            for (let i = 0; i <= run.length - n; i++) grams.push(run.slice(i, i + n));
          }
        } else {
          grams.push(run);
        }
      }
      units.push([tok, grams]);
    } else {
      units.push([tok, []]);
    }
  }
  return units;
}

function calcScore(mem, rawQuery, filterTags, filterTypes) {
  if (filterTypes && !filterTypes.has(mem.type)) return 0;
  const memTags = new Set((mem.tags || []).map((t) => t.toLowerCase()));
  if (filterTags.size && ![...filterTags].every((t) => memTags.has(t))) return 0;

  const text = `${mem.title || ""} ${mem.summary || ""} ${mem.details || ""}`.toLowerCase();

  let keyword = 0;
  if (rawQuery) {
    const units = expandQueryUnits(rawQuery.toLowerCase());
    let matches = 0;
    for (const [orig, grams] of units) {
      if (text.includes(orig) || grams.some((g) => text.includes(g))) matches++;
    }
    keyword = units.length ? matches / units.length : 0;
  } else {
    keyword = 1;
  }
  if (rawQuery && keyword === 0 && !filterTags.size) return 0;

  let tagScore = 0;
  if (rawQuery && memTags.size) {
    const units = expandQueryUnits(rawQuery.toLowerCase());
    let m = 0;
    for (const [orig, grams] of units) {
      let hit = false;
      for (const tag of memTags) {
        if (orig.includes(tag) || tag.includes(orig) || grams.some((g) => tag.includes(g))) {
          hit = true;
          break;
        }
      }
      if (hit) m++;
    }
    tagScore = units.length ? m / units.length : 0;
  } else {
    tagScore = memTags.size ? 0.5 : 0;
  }

  const typeScore = filterTypes ? 1.0 : 0.5;

  let recency = 0.5;
  if (mem.created_at) {
    const days = Math.max(0, (Date.now() - new Date(mem.created_at).getTime()) / 86400000);
    recency = Math.exp(-0.01 * days);
  }

  const importance = parseFloat(mem.importance ?? 0.5);
  const total = 0.4 * keyword + 0.25 * tagScore + 0.2 * typeScore + 0.1 * recency + 0.05 * importance;
  return +total.toFixed(4);
}

/** Ebbinghaus-style decay: accessed memories decay slower, P1 slowest. */
function computeDecay(mem) {
  const imp = parseFloat(mem.importance ?? 0.5);
  const pDecay = PRIORITY_DECAY[mem.priority || inferPriority(imp)] || 0.5;
  const acc = parseInt(mem.access_count ?? 0, 10) || 0;
  let days = 0;
  const last = mem.last_accessed || mem.created_at;
  if (last) {
    try {
      days = Math.max(0, (Date.now() - new Date(last).getTime()) / 86400000);
    } catch (e) {
      days = 0;
    }
  }
  const stability = 1 + 0.2 * Math.log10(acc + 1);
  const score = imp * Math.pow(pDecay, days / 7) * stability;
  return +Math.min(1, Math.max(0, score)).toFixed(4);
}

// ==============================================================================
// Subcommand handlers
// ==============================================================================

function cmdInit(a) {
  const storePath = resolveStorePath(a.store_path, a.scope || "global");
  ensureStoreDir(storePath);
  process.stdout.write(`Initialized memory store at: ${storePath}\n`);
}

function cmdStore(a) {
  if (!VALID_TYPES.includes(a.type)) {
    process.stderr.write(`Error: Invalid memory type '${a.type}'. Must be one of: ${VALID_TYPES.join(", ")}\n`);
    process.exit(1);
  }
  const storePath = resolveStorePath(a.store_path, a.scope || "global");
  const memories = loadMemories(storePath);
  const tags = a.tags ? a.tags.split(",").map((t) => t.trim().toLowerCase()) : [];
  const relatedFiles = a.related_files ? a.related_files.split(",").map((f) => f.trim()) : [];
  const importance = parseFloat(a.importance ?? 0.5);
  const scopeName = normalizeScope(a.scope || "global");
  const visibility = a.visibility || DEFAULT_VISIBILITY[scopeName] || "shared";
  let expiresAt = null;
  if (a.ttl_days) {
    expiresAt = new Date(Date.now() + parseInt(a.ttl_days, 10) * 86400000).toISOString();
  }
  const mem = {
    id: generateId(),
    schema_version: SCHEMA_VERSION,
    scope: scopeName,
    visibility: visibility,
    owner_agent: a.agent_id || process.env.MEMORY_AGENT_ID || null,
    created_at: nowISO(),
    updated_at: nowISO(),
    source_conversation_id: a.source_conv_id || null,
    type: a.type,
    title: a.title,
    summary: a.summary,
    details: a.details || null,
    tags: tags,
    importance: importance,
    priority: a.priority || inferPriority(importance),
    access_count: 0,
    last_accessed: null,
    related_files: relatedFiles,
    ttl_days: a.ttl_days ? parseInt(a.ttl_days, 10) : null,
    expires_at: expiresAt,
    decay_score: importance,
    status: "active",
    embedding: null,
    embedding_model: null,
  };
  memories.push(mem);
  saveMemories(storePath, memories);
  process.stdout.write(
    `Stored memory [${mem.id}] successfully in ${storePath} (scope=${mem.scope}, visibility=${mem.visibility})\n`
  );
}

function cmdSearch(a) {
  const query = a.query || "";
  const filterTags = new Set(a.tags ? a.tags.split(",").map((t) => t.trim().toLowerCase()) : []);
  const filterTypes = parseTypeFilter(a.type);
  const visibilityFilter = new Set(a.visibility ? a.visibility.split(",").map((v) => v.trim().toLowerCase()) : []);
  const asAgent = a.as_agent || process.env.MEMORY_AGENT_ID || null;

  const targetPaths = resolveTargetPaths(a.store_path, a.scope || "all");
  const results = [];
  const seen = new Set();

  for (const [scopeName, p] of targetPaths) {
    for (let m of loadMemories(p)) {
      if (seen.has(m.id)) continue;
      m = defaults(m, scopeName);
      if (asAgent && m.visibility === "private" && m.owner_agent !== asAgent) continue;
      if (visibilityFilter.size && !visibilityFilter.has(m.visibility)) continue;
      const score = calcScore(m, query, filterTags, filterTypes);
      if (score > 0) {
        seen.add(m.id);
        results.push({ ...m, _score: score, _store_scope: scopeName });
      }
    }
  }
  results.sort((x, y) => (y._score - x._score) || (y.created_at || "").localeCompare(x.created_at || ""));
  writeOutput(results.slice(0, parseInt(a.limit ?? 5, 10)), a.output);
}

function cmdRecall(a) {
  const targets = [
    ["global", resolveStorePath(a.store_path, "global")],
    ["workspace", resolveStorePath(a.store_path, "project")],
  ];
  for (const [scopeName, p] of targets) {
    const mems = loadMemories(p);
    const idx = mems.findIndex((m) => m.id === a.id);
    if (idx >= 0) {
      const m = defaults(mems[idx], scopeName);
      m.access_count = (m.access_count || 0) + 1;
      m.last_accessed = nowISO();
      mems[idx] = m;
      saveMemories(p, mems);
      writeOutput(m, a.output);
      return;
    }
  }
  process.stderr.write(`Error: Memory with ID '${a.id}' not found.\n`);
  process.exit(1);
}

function cmdList(a) {
  const targetPaths = resolveTargetPaths(a.store_path, a.scope || "global");
  let mems = [];
  for (const [scopeName, p] of targetPaths) {
    for (let m of loadMemories(p)) {
      m = defaults(m, scopeName);
      m._store_scope = scopeName;
      mems.push(m);
    }
  }
  if (a.type) {
    const filterTypes = parseTypeFilter(a.type);
    if (filterTypes) mems = mems.filter((m) => filterTypes.has(m.type));
  }
  if (a.tags) {
    const req = new Set(a.tags.split(",").map((t) => t.trim().toLowerCase()));
    mems = mems.filter((m) => req.size && [...req].every((t) => (m.tags || []).includes(t)));
  }
  if (a.status) mems = mems.filter((m) => m.status === a.status);
  if (a.visibility) {
    const vs = new Set(a.visibility.split(",").map((v) => v.trim().toLowerCase()));
    mems = mems.filter((m) => vs.has(m.visibility));
  }
  const sortKey = a.sort_by || "created_at";
  if (sortKey === "importance") mems.sort((x, y) => parseFloat(y.importance || 0) - parseFloat(x.importance || 0));
  else if (sortKey === "access_count") mems.sort((x, y) => (y.access_count || 0) - (x.access_count || 0));
  else mems.sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
  writeOutput(mems.slice(0, parseInt(a.limit ?? 20, 10)), a.output);
}

function cmdUpdate(a) {
  let storePath = resolveStorePath(a.store_path, "global");
  let mems = loadMemories(storePath);
  let idx = mems.findIndex((m) => m.id === a.id);
  if (idx === -1) {
    storePath = resolveStorePath(a.store_path, "project");
    mems = loadMemories(storePath);
    idx = mems.findIndex((m) => m.id === a.id);
  }
  if (idx === -1) {
    process.stderr.write(`Error: Memory ID '${a.id}' not found.\n`);
    process.exit(1);
  }
  const m = mems[idx];
  if (a.title) m.title = a.title;
  if (a.summary) m.summary = a.summary;
  if (a.details) m.details = a.details;
  if (a.tags) m.tags = a.tags.split(",").map((t) => t.trim().toLowerCase());
  if (a.importance !== undefined) {
    m.importance = parseFloat(a.importance);
    m.decay_score = m.importance;
  }
  if (a.visibility) {
    if (!VISIBILITIES.includes(a.visibility)) {
      process.stderr.write(`Error: Invalid visibility '${a.visibility}'. Must be one of: ${VISIBILITIES.join(", ")}\n`);
      process.exit(1);
    }
    m.visibility = a.visibility;
  }
  if (a.priority) {
    if (!PRIORITIES.includes(a.priority)) {
      process.stderr.write(`Error: Invalid priority '${a.priority}'. Must be one of: ${PRIORITIES.join(", ")}\n`);
      process.exit(1);
    }
    m.priority = a.priority;
  }
  m.updated_at = nowISO();
  mems[idx] = m;
  saveMemories(storePath, mems);
  process.stdout.write(`Updated memory [${a.id}] in ${storePath}\n`);
}

function cmdDelete(a) {
  const paths = [resolveStorePath(a.store_path, "global"), resolveStorePath(a.store_path, "project")];
  for (const p of paths) {
    const mems = loadMemories(p);
    const kept = mems.filter((m) => m.id !== a.id);
    if (kept.length < mems.length) {
      saveMemories(p, kept);
      process.stdout.write(`Deleted memory [${a.id}] from ${p}\n`);
      return;
    }
  }
  process.stderr.write(`Error: Memory ID '${a.id}' not found.\n`);
  process.exit(1);
}

function cmdMerge(a) {
  const ids = a.ids.split(",").map((s) => s.trim());
  if (ids.length < 2) {
    process.stderr.write("Error: Specify at least 2 memory IDs to merge.\n");
    process.exit(1);
  }
  const storePath = resolveStorePath(a.store_path, a.scope || "global");
  const mems = loadMemories(storePath);
  const targets = mems.filter((m) => ids.includes(m.id));
  if (targets.length !== ids.length) {
    process.stderr.write("Error: Could not find all specified memory IDs in the store.\n");
    process.exit(1);
  }
  const allTags = [...new Set(targets.flatMap((t) => t.tags || []))].sort();
  const maxImp = Math.max(...targets.map((t) => parseFloat(t.importance || 0)));
  const allFiles = [...new Set(targets.flatMap((t) => t.related_files || []))].sort();
  const merged = defaults({
    id: generateId(),
    created_at: nowISO(),
    updated_at: nowISO(),
    source_conversation_id: null,
    type: targets[0].type || "fact",
    title: `Merged: ${targets[0].title || ""}`,
    summary: targets.map((t) => t.summary || "").join(" | "),
    details: `Merged from original IDs: ${ids.join(", ")}`,
    tags: allTags,
    importance: maxImp,
    access_count: targets.reduce((s, t) => s + (t.access_count || 0), 0),
    last_accessed: nowISO(),
    related_files: allFiles,
    ttl_days: null,
  }, storePath);
  const remaining = mems.filter((m) => !ids.includes(m.id));
  remaining.push(merged);
  saveMemories(storePath, remaining);
  writeOutput(merged, a.output);
}

function cmdArchive(a) {
  const storePath = resolveStorePath(a.store_path, a.scope || "global");
  const mems = loadMemories(storePath);
  const now = new Date();
  const toArchive = [];
  const toKeep = [];
  const minDecay = a.min_decay !== undefined ? parseFloat(a.min_decay) : 0.15;

  for (let m of mems) {
    m = defaults(m, a.scope || "global");
    let reason = null;
    if (a.apply_decay) m.decay_score = computeDecay(m);
    const created = new Date(m.created_at);
    const daysOld = Math.max(0, (now - created) / 86400000);
    if (m.ttl_days && daysOld >= m.ttl_days) {
      reason = `TTL expired (${daysOld.toFixed(1)} >= ${m.ttl_days} days)`;
    } else if (a.before_days && daysOld >= parseFloat(a.before_days) && (m.access_count || 0) < 2) {
      reason = `Older than ${a.before_days} days and low access count`;
    } else if (a.min_importance !== undefined && parseFloat(m.importance || 0) < parseFloat(a.min_importance)) {
      reason = `Importance below threshold (${m.importance} < ${a.min_importance})`;
    } else if (parseFloat(m.decay_score || 0) < minDecay) {
      reason = `Decay below threshold (${m.decay_score} < ${minDecay})`;
    }
    if (reason) {
      m._archive_reason = reason;
      toArchive.push(m);
    } else {
      toKeep.push(m);
    }
  }

  if (toArchive.length) {
    saveMemories(storePath, toKeep);
    const archiveDir = path.join(storePath, "archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const archiveFile = path.join(archiveDir, `archived_${now.toISOString().slice(0, 7).replace("-", "")}.json`);
    let existing = [];
    if (fs.existsSync(archiveFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(archiveFile, "utf8"));
      } catch (e) {
        existing = [];
      }
    }
    atomicWriteJson(archiveFile, existing.concat(toArchive));
    process.stdout.write(`Archived ${toArchive.length} memories to: ${archiveFile}\n`);
  }
  writeOutput(toArchive, a.output);
}

function cmdStats(a) {
  const targetPaths = resolveTargetPaths(a.store_path, a.scope || "global");
  const mems = [];
  for (const [scopeName, p] of targetPaths) {
    for (let m of loadMemories(p)) mems.push(defaults(m, scopeName));
  }
  const typeCounts = {};
  const tagCounts = {};
  const scopeCounts = {};
  const visCounts = {};
  const statusCounts = {};
  let totalImp = 0;
  for (const m of mems) {
    typeCounts[m.type || "unknown"] = (typeCounts[m.type || "unknown"] || 0) + 1;
    for (const t of m.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
    scopeCounts[m.scope || "unknown"] = (scopeCounts[m.scope || "unknown"] || 0) + 1;
    visCounts[m.visibility || "unknown"] = (visCounts[m.visibility || "unknown"] || 0) + 1;
    statusCounts[m.status || "active"] = (statusCounts[m.status || "active"] || 0) + 1;
    totalImp += parseFloat(m.importance || 0);
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const mostAccessed = mems
    .map((m) => ({ id: m.id, title: m.title, access_count: m.access_count || 0 }))
    .sort((a, b) => b.access_count - a.access_count)
    .slice(0, 5);
  writeOutput(
    {
      store_path: targetPaths.map(([, p]) => p),
      total_memories: mems.length,
      avg_importance: mems.length ? +(totalImp / mems.length).toFixed(3) : 0,
      scope_breakdown: scopeCounts,
      visibility_breakdown: visCounts,
      status_breakdown: statusCounts,
      type_breakdown: typeCounts,
      top_tags: Object.fromEntries(topTags),
      most_accessed: mostAccessed,
    },
    a.output
  );
}

/**
 * Extract a memory-relevant fragment from one transcript step.
 * Supports two formats:
 *   - Antigravity transcript: { type: "USER_INPUT" | "PLANNER_RESPONSE", ... }
 *   - Generic chat log:       { role: "user"|"assistant"|"system", content|text }
 * Returns a fragment object, or null if the step is not recognizable.
 */
function extractFragment(step) {
  if (!step || typeof step !== "object") return null;
  if (step.type === "USER_INPUT") {
    return { role: "user", content: (step.content || "").slice(0, 1000) };
  }
  if (step.type === "PLANNER_RESPONSE") {
    const toolCalls = step.tool_calls || [];
    const toolNames = toolCalls
      .filter((tc) => typeof tc === "object")
      .map((tc) => tc.name || tc.tool_name || "");
    return {
      role: "assistant",
      summary: (step.content || "").slice(0, 500) || "Tool calls executed",
      tools_used: toolNames,
    };
  }
  const role = (step.role || "").toString().toLowerCase();
  if (role === "user" || role === "assistant" || role === "system") {
    const c = step.content || step.text || "";
    return { role, content: c.slice(0, 1000) };
  }
  return null;
}

function cmdCompress(a) {
  const input = path.resolve(a.input);
  if (!fs.existsSync(input)) {
    process.stderr.write(`Error: Transcript file not found at ${input}\n`);
    process.exit(1);
  }
  const fragments = [];
  let detectedFormat = "unknown";

  // Pass 1: per-line JSON (Antigravity JSONL / one-object-per-line chat logs)
  for (const line of fs.readFileSync(input, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let step;
    try {
      step = JSON.parse(line);
    } catch (e) {
      continue;
    }
    const f = extractFragment(step);
    if (f) {
      fragments.push(f);
      detectedFormat = step.type ? "antigravity" : "generic-chat";
    }
  }

  // Pass 2: whole-file JSON array (single-line or pretty-printed)
  if (fragments.length === 0) {
    try {
      const arr = JSON.parse(fs.readFileSync(input, "utf8"));
      if (Array.isArray(arr)) {
        for (const obj of arr) {
          const f = extractFragment(obj);
          if (f) {
            fragments.push(f);
            detectedFormat = obj.type ? "antigravity" : "generic-chat";
          }
        }
      }
    } catch (e) {
      /* not a JSON array */
    }
  }

  if (fragments.length === 0) {
    process.stderr.write(
      "Warning: No recognizable transcript fragments found. Supported formats: Antigravity transcript " +
        "(type USER_INPUT/PLANNER_RESPONSE) and generic chat ({role, content|text}). For other platforms, " +
        "store memories manually with the `store` subcommand.\n"
    );
  }

  writeOutput(
    {
      source_transcript: input,
      detected_format: detectedFormat,
      extracted_steps_count: fragments.length,
      conversation_fragments: fragments,
      instructions_for_agent:
        "Review the extracted conversation fragments above. Identify key decisions, workflows, facts, preferences, or debug solutions. Summarize each into a concise memory entry and call `store` subcommand to persist. For platforms whose transcript format is unsupported, summarize manually and call `store` directly.",
    },
    a.output
  );
}

function cmdMigrate(a) {
  const targetStore = resolveStorePath(a.store_path, "global"); // universal: ~/.memory-store
  const targetMems = loadMemories(targetStore);
  const seenIds = new Set(targetMems.map((m) => m.id));
  const seenSig = new Set(targetMems.map((m) => memSignature(defaults(m, "global"))));

  const dryRun = a.dry_run === true || a["dry-run"] === true;
  const sourcesFound = [];
  let migrated = 0;
  let skipped = 0;

  for (const [platform, legacyPath] of Object.entries(LEGACY_GLOBAL_STORES)) {
    const memFile = path.join(legacyPath, "memories.json");
    if (!fs.existsSync(memFile)) continue;
    const legacyMems = loadMemories(legacyPath);
    if (!legacyMems.length) continue;

    const archived = [];
    const archiveDir = path.join(legacyPath, "archive");
    if (fs.existsSync(archiveDir)) {
      for (const f of fs.readdirSync(archiveDir)) {
        if (!f.startsWith("archived_") || !f.endsWith(".json")) continue;
        try {
          const arr = JSON.parse(fs.readFileSync(path.join(archiveDir, f), "utf8"));
          if (Array.isArray(arr)) archived.push(...arr);
        } catch (e) {
          /* ignore corrupted archive */
        }
      }
    }

    sourcesFound.push({
      platform,
      path: legacyPath,
      active: legacyMems.length,
      archived: archived.length,
    });

    const candidates = legacyMems.concat(archived);
    for (let m of candidates) {
      m = defaults(m, "global");
      if (seenIds.has(m.id) || seenSig.has(memSignature(m))) {
        skipped++;
        continue;
      }
      seenSig.add(memSignature(m));
      seenIds.add(m.id);
      targetMems.push(m);
      migrated++;
    }
  }

  if (migrated > 0 && !dryRun) {
    saveMemories(targetStore, targetMems);
  }

  const report = {
    target_store: targetStore,
    dry_run: dryRun,
    sources_found: sourcesFound,
    migrated,
    skipped,
    total_now: targetMems.length,
  };
  if (dryRun) {
    process.stdout.write(
      `[dry-run] Would migrate ${migrated} memories (skip ${skipped}) into ${targetStore}\n`
    );
  }
  writeOutput(report, a.output);
}

function cmdVersion(a) {
  let version = VERSION;
  // Prefer package.json when present (dev context); fall back to the
  // authoritative VERSION constant above (deployed skill without package.json).
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
    );
    version = pkg.version || version;
  } catch (e) {
    /* fall back to VERSION constant */
  }
  const info = {
    name: "memory-store",
    version,
    runtime: "node",
    note: "Pure Node.js implementation — zero dependencies, no Python required.",
  };
  if (a.output) {
    writeOutput(info, a.output);
  } else {
    process.stdout.write(`${info.name} v${info.version} (${info.runtime})\n`);
  }
}

// ==============================================================================
// CLI parser & main
// ==============================================================================

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-/g, "_"); // --store-path -> store_path
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    process.stdout.write(
      "Memory Store CLI (Node.js). Commands:\n" +
      "  init store search recall list update delete merge archive stats compress migrate version\n" +
      "Usage: memory-store <command> [--key value ...]\n" +
"       node scripts/memory_cli.js <command> [--key value ...]\n" +
      "Output: results print as JSON to stdout by default; use --output <file> to write a file.\n" +
      "        --stdout forces stdout explicitly. --type accepts comma-separated values.\n" +
      "        version / -v / --version prints the installed version.\n" +
      "Docs: see SKILL.md (relative to the skill directory)\n"
    );
    return;
  }
  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    cmdVersion(parseArgs(argv.slice(1)));
    return;
  }
  const command = argv[0];
  const a = parseArgs(argv.slice(1));
  // --stdout forces JSON to stdout (no file). Output already defaults to stdout
  // when --output is omitted; this makes the intent explicit.
  if (a.stdout) delete a.output;
  const handlers = {
    init: cmdInit,
    store: cmdStore,
    search: cmdSearch,
    recall: cmdRecall,
    list: cmdList,
    update: cmdUpdate,
    delete: cmdDelete,
    merge: cmdMerge,
    archive: cmdArchive,
    stats: cmdStats,
    compress: cmdCompress,
    migrate: cmdMigrate,
    version: cmdVersion,
  };
  if (!handlers[command]) {
    process.stderr.write(`Error: Unknown command '${command}'\n`);
    process.exit(1);
  }
  handlers[command](a);
}

main();
