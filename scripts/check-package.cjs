"use strict";
// WorkBuddy 分享包结构自检脚本（纯 Node.js，无第三方依赖）。
// 用法: node scripts/check-package.cjs —— 以脚本自身位置推断包根，在包内任意位置运行皆可。
// 存在 FAIL 时退出码为 1。

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const EXPERTS_DIR = path.join(ROOT, "experts");
const PLUGIN_DIR = path.join(EXPERTS_DIR, ".codebuddy-plugin");
const PLUGIN_PATH = path.join(PLUGIN_DIR, "plugin.json");
const AGENTS_DIR = path.join(EXPERTS_DIR, "agents");
const AVATARS_DIR = path.join(EXPERTS_DIR, "avatars");

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function report(level, msg) {
  if (level === "PASS") passCount++;
  else if (level === "WARN") warnCount++;
  else failCount++;
  console.log(`[${level}] ${msg}`);
}

function group(label, problems, passNote) {
  if (problems.length) report("FAIL", `${label} — ${problems.join("；")}`);
  else report("PASS", `${label}${passNote ? `（${passNote}）` : ""}`);
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

function rel(p) {
  const r = path.relative(ROOT, p);
  return (r && !r.startsWith("..") ? r : p).split(path.sep).join("/");
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function nonEmptyStr(v) {
  return typeof v === "string" && v.trim() !== "";
}

function short(v, n = 60) {
  const s = JSON.stringify(v);
  return s && s.length > n ? s.slice(0, n) + "…" : s;
}

function stripQuotes(s) {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

// 简易 YAML frontmatter 行解析（不引库）：
// 支持 frontmatter 内顶层 key、缩进子 key（如 displayName 下的 en/zh）、行内 {en: x, zh: y}。
// 返回 Map；字符串 key 形如 "displayName.en"；无合法 frontmatter 返回 null。
function parseFrontmatter(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  const lines = src.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  const fm = new Map();
  let current = null;
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = raw.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2];
    const val = m[3].trim();
    if (indent === 0) {
      current = key;
      const flow = val.match(/^\{(.*)\}$/);
      if (flow) {
        fm.set(key, "");
        for (const part of flow[1].split(",")) {
          const kv = part.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*?)\s*$/);
          if (kv) fm.set(`${key}.${kv[1]}`, stripQuotes(kv[2]));
        }
      } else {
        fm.set(key, stripQuotes(val)); // 块标量 "|" / ">" 也视为“有内容”
      }
    } else if (current) {
      fm.set(`${current}.${key}`, stripQuotes(val));
    }
  }
  return fm;
}

function fmHas(fm, key) {
  return Boolean(fm) && fm.has(key) && String(fm.get(key)).trim() !== "";
}

function resolveExisting(ref, bases) {
  for (const base of bases) {
    const p = path.resolve(base, ref);
    if (isFile(p)) return { path: p, base };
  }
  return null;
}

function basenameNoExt(p) {
  return path.basename(p).replace(/\.md$/i, "");
}

// ---------- 检查 3 的字段校验 ----------
function validatePluginFields(plugin) {
  const needStr = (problems, v, label) => {
    if (!nonEmptyStr(v)) problems.push(`${label} 缺失或非字符串`);
  };

  // 基础字段
  {
    const p = [];
    needStr(p, plugin.name, "name");
    if (plugin.expertType !== "team") p.push(`expertType 应为 "team"，实际 ${short(plugin.expertType)}`);
    needStr(p, plugin.version, "version");
    needStr(p, plugin.description, "description");
    if (!plugin.author || typeof plugin.author !== "object" || Array.isArray(plugin.author)) p.push("author 缺失或非对象");
    else needStr(p, plugin.author.name, "author.name");
    needStr(p, plugin.agentName, "agentName");
    group("基础字段 name/expertType/version/description/author.name/agentName", p);
  }

  // teamInfo
  {
    const p = [];
    const ti = plugin.teamInfo;
    if (!ti || typeof ti !== "object" || Array.isArray(ti)) p.push("teamInfo 缺失或非对象");
    else {
      if (!nonEmptyStr(ti.leadAgent)) p.push("teamInfo.leadAgent 缺失或非字符串");
      if (!Array.isArray(ti.memberAgents) || ti.memberAgents.length === 0) p.push("teamInfo.memberAgents 应为非空数组");
    }
    group("teamInfo.leadAgent / teamInfo.memberAgents", p);
  }

  // displayName / profession 中英
  {
    const p = [];
    for (const key of ["displayName", "profession"]) {
      const obj = plugin[key];
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        p.push(`${key} 缺失或非对象`);
        continue;
      }
      needStr(p, obj.en, `${key}.en`);
      needStr(p, obj.zh, `${key}.zh`);
    }
    group("本地化字段 displayName/profession（en+zh）", p);
  }

  // displayDescription：zh 长度 40-50（含边界，按 Unicode 码点计）
  {
    const p = [];
    let note = "";
    const dd = plugin.displayDescription;
    if (!dd || typeof dd !== "object" || Array.isArray(dd)) p.push("displayDescription 缺失或非对象");
    else {
      needStr(p, dd.en, "displayDescription.en");
      if (!nonEmptyStr(dd.zh)) p.push("displayDescription.zh 缺失或非字符串");
      else {
        const n = Array.from(dd.zh).length; // 按 Unicode 码点计数，含标点与空格，不额外 trim
        if (n < 40 || n > 50) p.push(`displayDescription.zh 长度 ${n}，不在 40-50 之间（含边界，按 Unicode 字符计）`);
        else note = `displayDescription.zh 长度 ${n}，在 40-50 之间`;
      }
    }
    group("displayDescription（en+zh，zh 长度 40-50 含边界）", p, note);
  }

  // tags：恰好 3 个，每个含 en/zh
  {
    const p = [];
    if (!Array.isArray(plugin.tags) || plugin.tags.length !== 3) {
      p.push(`tags 应为恰好 3 个的数组，实际 ${Array.isArray(plugin.tags) ? `${plugin.tags.length} 个` : typeof plugin.tags}`);
    } else {
      plugin.tags.forEach((t, i) => {
        if (!t || typeof t !== "object" || Array.isArray(t)) {
          p.push(`tags[${i}] 非对象`);
          return;
        }
        needStr(p, t.en, `tags[${i}].en`);
        needStr(p, t.zh, `tags[${i}].zh`);
      });
    }
    group("tags（恰好 3 个，每个含 en/zh）", p);
  }

  // quickPrompts：恰好 3 个，每个含 en/zh
  {
    const p = [];
    if (!Array.isArray(plugin.quickPrompts) || plugin.quickPrompts.length !== 3) {
      p.push(`quickPrompts 应为恰好 3 个的数组，实际 ${Array.isArray(plugin.quickPrompts) ? `${plugin.quickPrompts.length} 个` : typeof plugin.quickPrompts}`);
    } else {
      plugin.quickPrompts.forEach((q, i) => {
        if (!q || typeof q !== "object" || Array.isArray(q)) {
          p.push(`quickPrompts[${i}] 非对象`);
          return;
        }
        needStr(p, q.en, `quickPrompts[${i}].en`);
        needStr(p, q.zh, `quickPrompts[${i}].zh`);
      });
    }
    group("quickPrompts（恰好 3 个，每个含 en/zh）", p);
  }

  // defaultInitPrompt 与 quickPrompts[0] 完全一致
  {
    const p = [];
    const qp = plugin.quickPrompts;
    const dip = plugin.defaultInitPrompt;
    if (!Array.isArray(qp) || !qp.length || !qp[0] || typeof qp[0] !== "object") p.push("quickPrompts[0] 无效，无法比较");
    else if (!dip || typeof dip !== "object" || Array.isArray(dip)) p.push("defaultInitPrompt 缺失或非对象");
    else {
      if (dip.en !== qp[0].en) p.push(`en 不一致: defaultInitPrompt=${short(dip.en)} vs quickPrompts[0].en=${short(qp[0].en)}`);
      if (dip.zh !== qp[0].zh) p.push(`zh 不一致: defaultInitPrompt=${short(dip.zh)} vs quickPrompts[0].zh=${short(qp[0].zh)}`);
    }
    group("defaultInitPrompt 与 quickPrompts[0] 完全一致（en+zh）", p);
  }

  // members 结构
  {
    const p = [];
    const members = plugin.members;
    if (!Array.isArray(members) || members.length === 0) p.push("members 应为非空数组");
    else {
      members.forEach((m, i) => {
        if (!m || typeof m !== "object" || Array.isArray(m)) {
          p.push(`members[${i}] 非对象`);
          return;
        }
        const tag = `members[${i}]${nonEmptyStr(m.id) ? `(id=${m.id})` : ""}`;
        if (!nonEmptyStr(m.id)) p.push(`${tag}.id 缺失或非字符串`);
        for (const key of ["name", "profession"]) {
          const obj = m[key];
          if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            p.push(`${tag}.${key} 缺失或非对象`);
            continue;
          }
          needStr(p, obj.en, `${tag}.${key}.en`);
          needStr(p, obj.zh, `${tag}.${key}.zh`);
        }
        if (!nonEmptyStr(m.avatar)) p.push(`${tag}.avatar 缺失或非字符串`);
        if (m.role !== "lead" && m.role !== "member") p.push(`${tag}.role 应为 lead|member，实际 ${short(m.role)}`);
      });
    }
    group("members 结构（id/name/profession/avatar/role）", p);
  }

  // 恰有一个 lead 且 id === teamInfo.leadAgent
  {
    const p = [];
    const members = plugin.members;
    if (!Array.isArray(members) || members.length === 0) p.push("members 无效，无法校验 lead 唯一性");
    else {
      const leads = members.filter((m) => m && m.role === "lead");
      if (leads.length !== 1) p.push(`role=lead 应恰好 1 个，实际 ${leads.length} 个`);
      else {
        const tiLead = plugin.teamInfo && plugin.teamInfo.leadAgent;
        if (leads[0].id !== tiLead) p.push(`lead 的 id=${short(leads[0].id)} 与 teamInfo.leadAgent=${short(tiLead)} 不一致`);
      }
    }
    group("恰有一个 lead 且其 id === teamInfo.leadAgent", p);
  }
}

// ---------- 检查 4 ----------
function validateAgents(plugin) {
  const resolved = [];
  if (!plugin || !Array.isArray(plugin.agents) || plugin.agents.length === 0) {
    report("FAIL", "agents[] 路径检查无法执行（plugin.json 缺失或 agents[] 无效）");
    return resolved;
  }
  const bases = [PLUGIN_DIR, EXPERTS_DIR, ROOT, AGENTS_DIR];
  {
    const p = [];
    plugin.agents.forEach((ref, i) => {
      if (!nonEmptyStr(ref)) {
        p.push(`agents[${i}] 不是有效路径字符串`);
        return;
      }
      const hit = resolveExisting(ref, bases);
      if (!hit) p.push(`agents[${i}] 路径不存在: ${ref}（尝试: ${bases.map((b) => rel(path.resolve(b, ref))).join(", ")}）`);
      else resolved.push({ ref, path: hit.path });
    });
    group("agents[] 每个路径都存在", p);
  }

  {
    const p = [];
    let leadNote = "";
    const members = plugin.members;
    const memberIds = Array.isArray(members) ? members.filter((m) => m && nonEmptyStr(m.id)).map((m) => m.id) : [];
    if (!resolved.length) p.push("没有可解析的 agent 文件，无法检查文件名与 members[].id 的对应关系");
    else if (!memberIds.length) p.push("members[] 缺失或没有有效 id，无法检查对应关系");
    else {
      const files = resolved.map((r) => ({ path: r.path, base: basenameNoExt(r.path) }));
      const matched = new Map();
      for (const id of memberIds) {
        // 允许主理人文件带 {name}- 前缀：文件名 == id 或以 "-id" 结尾
        const hits = files.filter((f) => f.base === id || f.base.endsWith(`-${id}`));
        if (hits.length !== 1) p.push(`members id "${id}" 对应 ${hits.length} 个 md 文件（应为 1）`);
        else matched.set(id, hits[0]);
      }
      const claimed = new Map();
      for (const [id, f] of matched) {
        if (!claimed.has(f.path)) claimed.set(f.path, []);
        claimed.get(f.path).push(id);
      }
      for (const [fp, ids] of claimed) {
        if (ids.length > 1) p.push(`文件 ${rel(fp)} 同时匹配多个 id: ${ids.join(", ")}`);
      }
      const unclaimed = files.filter((f) => !claimed.has(f.path));
      if (unclaimed.length) p.push(`未被任何 members id 匹配的 md: ${unclaimed.map((f) => rel(f.path)).join(", ")}`);

      const tiLead = plugin.teamInfo && plugin.teamInfo.leadAgent;
      if (!nonEmptyStr(tiLead)) p.push("teamInfo.leadAgent 缺失，无法校验主理人文件名前缀");
      else if (!nonEmptyStr(plugin.name)) p.push("plugin.json name 缺失，无法校验主理人文件名前缀");
      else {
        const f = matched.get(tiLead);
        if (!f) p.push(`leadAgent "${tiLead}" 未匹配到 md 文件，无法校验文件名前缀`);
        else if (f.base === `${plugin.name}-team-lead`) leadNote = `主理人文件名严格符合 ${plugin.name}-team-lead.md`;
        else if (f.base.startsWith(`${plugin.name}-`)) leadNote = `主理人文件名 "${f.base}.md" 以团队名前缀开头（非精确 {name}-team-lead.md 形式）`;
        else p.push(`主理人 md 文件名 "${f.base}.md" 不以团队名前缀 "${plugin.name}-" 开头（期望形如 "${plugin.name}-team-lead.md"）`);
      }
    }
    group("文件名（不含 .md）与 members[].id 一一对应；主理人文件以团队名前缀开头", p, p.length ? undefined : leadNote);
  }
  return resolved;
}

// ---------- 检查 5 ----------
function validateAgentMds(agentResolved) {
  let files = agentResolved.map((r) => r.path);
  let source = "plugin.json agents[]";
  if (!files.length && isDir(AGENTS_DIR)) {
    files = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .sort()
      .map((f) => path.join(AGENTS_DIR, f));
    source = "experts/agents/ 目录列举";
  }
  if (!files.length) {
    report("FAIL", "找不到 agent md 文件（experts/agents/ 目录不存在或为空，plugin.json 也未提供有效 agents[]）");
    return;
  }
  if (source === "experts/agents/ 目录列举") {
    if (files.length !== 5) report("FAIL", `experts/agents/ 下应有 5 个 md，实际 ${files.length} 个`);
    else report("PASS", "experts/agents/ 下恰有 5 个 md");
  }
  const required = ["name", "description", "displayName.en", "displayName.zh", "profession.en", "profession.zh", "maxTurns"];
  for (const p of files) {
    const text = readText(p);
    if (text === null) {
      report("FAIL", `${rel(p)} 不可读`);
      continue;
    }
    const fm = parseFrontmatter(text);
    if (!fm) {
      report("FAIL", `${rel(p)} 缺少合法 YAML frontmatter`);
      continue;
    }
    const missing = required.filter((k) => !fmHas(fm, k));
    if (missing.length) report("FAIL", `${rel(p)} frontmatter 缺失字段: ${missing.join(", ")}`);
    else report("PASS", `${rel(p)} frontmatter 字段齐全（${required.join(", ")}）`);
  }
}

// ---------- 检查 6 ----------
function validateAvatars(plugin) {
  if (!plugin) {
    report("FAIL", "members[].avatar / 顶层 avatar 校验无法执行（plugin.json 缺失或无效）");
    return;
  }
  const refs = [];
  if (nonEmptyStr(plugin.avatar)) refs.push({ label: "顶层 avatar", ref: plugin.avatar });
  else refs.push({ label: "顶层 avatar", ref: null });
  if (Array.isArray(plugin.members)) {
    plugin.members.forEach((m, i) => {
      const label = `members[${i}]${m && nonEmptyStr(m.id) ? `(id=${m.id})` : ""} avatar`;
      if (m && nonEmptyStr(m.avatar)) refs.push({ label, ref: m.avatar });
      else refs.push({ label, ref: null });
    });
  }
  for (const { label, ref } of refs) {
    if (ref === null) {
      report("FAIL", `${label} 缺失或非字符串`);
      continue;
    }
    const candidates = [
      ...new Set([
        path.resolve(PLUGIN_DIR, ref),
        path.resolve(EXPERTS_DIR, ref),
        path.resolve(ROOT, ref),
        path.join(AVATARS_DIR, path.basename(ref)),
      ]),
    ];
    const existing = candidates.filter(isFile);
    if (!existing.length) {
      report("FAIL", `${label} 指向的文件不存在: ${ref}（尝试: ${candidates.map(rel).join(", ")}）`);
    } else {
      const inAvatars = existing.find((p) => rel(p).startsWith("experts/avatars/"));
      if (inAvatars) report("PASS", `${label}: ${ref} -> ${rel(inAvatars)}`);
      else report("FAIL", `${label}: ${ref} 存在（${rel(existing[0])}）但不在 experts/avatars/ 下`);
    }
  }
}

// ---------- 主流程 ----------
function main() {
  console.log(`WorkBuddy 分享包自检，包根目录: ${ROOT}`);

  // 1. skill/SKILL.md
  section("检查 1：skill/SKILL.md 与 frontmatter 必填字段");
  const skillMdPath = path.join(ROOT, "skill", "SKILL.md");
  const skillText = isFile(skillMdPath) ? readText(skillMdPath) : null;
  if (skillText === null) {
    report("FAIL", "skill/SKILL.md 不存在或不可读");
  } else {
    const fm = parseFrontmatter(skillText);
    if (!fm) {
      report("FAIL", "skill/SKILL.md 缺少合法 YAML frontmatter（需以 --- 开始并以 --- 结束）");
    } else {
      const required = ["description", "description_zh", "description_en", "version", "author"];
      const missing = required.filter((k) => !fmHas(fm, k));
      if (missing.length) report("FAIL", `skill/SKILL.md frontmatter 缺失必填字段: ${missing.join(", ")}`);
      else report("PASS", `skill/SKILL.md frontmatter 含全部必填字段: ${required.join(", ")}`);
    }
  }

  // 2. skill/references/
  section("检查 2：skill/references/ 文件");
  const refDir = path.join(ROOT, "skill", "references");
  for (const f of ["model-menu.md", "team-config.template.md"]) {
    if (isFile(path.join(refDir, f))) report("PASS", `skill/references/${f} 存在`);
    else report("FAIL", `skill/references/${f} 不存在`);
  }
  for (const f of ["runtime.md", "roles.md"]) {
    if (isFile(path.join(refDir, f))) report("PASS", `skill/references/${f} 存在`);
    else report("WARN", `skill/references/${f} 不存在（允许缺失，仅提示）`);
  }

  // 3. plugin.json
  section("检查 3：experts/.codebuddy-plugin/plugin.json 字段");
  let plugin = null;
  if (!isFile(PLUGIN_PATH)) {
    report("FAIL", "experts/.codebuddy-plugin/plugin.json 不存在");
  } else {
    const raw = readText(PLUGIN_PATH);
    try {
      plugin = JSON.parse(raw);
      if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
        report("FAIL", "plugin.json 顶层应为 JSON 对象");
        plugin = null;
      } else {
        report("PASS", "plugin.json 存在且是合法 JSON 对象");
      }
    } catch (e) {
      report("FAIL", `plugin.json 不是合法 JSON: ${e.message}`);
      plugin = null;
    }
  }
  if (plugin) validatePluginFields(plugin);
  else report("FAIL", "plugin.json 字段校验无法执行（文件缺失或不是合法 JSON 对象）");

  // 4. agents 路径与命名
  section("检查 4：agents[] 路径存在性 + 文件名与 members id 对应");
  const agentResolved = validateAgents(plugin);

  // 5. agents md frontmatter
  section("检查 5：experts/agents/*.md frontmatter 字段");
  validateAgentMds(agentResolved);

  // 6. 头像
  section("检查 6：头像文件");
  const EXPECTED_AVATARS = [
    "team.png",
    "team-lead.png",
    "team-explorer.png",
    "team-executor.png",
    "team-reviewer.png",
    "team-expert-advisor.png",
  ];
  {
    const missing = EXPECTED_AVATARS.filter((f) => !isFile(path.join(AVATARS_DIR, f)));
    if (missing.length) report("FAIL", `experts/avatars/ 缺少预期头像: ${missing.join(", ")}`);
    else report("PASS", `experts/avatars/ 下 6 个预期头像均存在: ${EXPECTED_AVATARS.join(", ")}`);
  }
  validateAvatars(plugin);

  // 7. 根目录文档
  section("检查 7：根目录文档文件");
  for (const f of ["README-FIRST.md", "INSTALL-AI.md", "PROMPT-TO-SEND.md"]) {
    if (isFile(path.join(ROOT, f))) report("PASS", `${f} 存在`);
    else report("WARN", `${f} 不存在（主 Agent 创建后应补齐）`);
  }

  // 汇总
  section("汇总");
  console.log(`PASS ${passCount} / WARN ${warnCount} / FAIL ${failCount}`);
  if (failCount > 0) {
    console.log("存在 FAIL，退出码设为 1。");
    process.exitCode = 1;
  } else {
    console.log("全部必需检查通过。");
  }
}

try {
  main();
} catch (e) {
  report("FAIL", `自检脚本内部错误: ${e && e.stack ? e.stack : e}`);
  process.exitCode = 1;
}
