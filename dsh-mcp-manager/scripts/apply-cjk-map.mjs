#!/usr/bin/env node
// Apply scripts/cjk-map.json translations to src/, replacing ONLY inside string
// literals ("...", '...', template chunks) and never inside comments.
// ponytail: char-scan tokenizer is deliberate - regex replaceAll would corrupt comments.
import fs from "node:fs";
import path from "node:path";
const PKG = path.resolve(new URL("..", import.meta.url).pathname);
const map = JSON.parse(fs.readFileSync(path.join(PKG, "scripts/cjk-map.json"), "utf8"));
// longest-first so longer keys win over their substrings
map.sort((a, b) => b[0].length - a[0].length);
const counts = new Map(map.map(([zh]) => [zh, 0]));

function walk(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(f.name)) out.push(p);
  }
  return out;
}

// translate one string-literal body
function tr(s) {
  let out = s;
  for (const [zh, en] of map) {
    if (out.includes(zh)) { out = out.split(zh).join(en); counts.set(zh, counts.get(zh) + 1); }
  }
  return out;
}

let changedFiles = 0;
for (const f of walk(path.join(PKG, "src"))) {
  if (f.includes(path.join(PKG, "src", "client"))) continue; // client is i18n-complete upstream (#348) — never touch
  const src = fs.readFileSync(f, "utf8");
  let out = "";
  let i = 0;
  let mode = "code"; // code | line-comment | block-comment | squote | dquote | template
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line-comment"; out += "//"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block-comment"; out += "/*"; i += 2; continue; }
      if (c === "'") { mode = "squote"; out += c; i += 1; continue; }
      if (c === '"') { mode = "dquote"; out += c; i += 1; continue; }
      if (c === String.fromCharCode(96)) { mode = "template"; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === "line-comment") { if (c === "\n") mode = "code"; out += c; i += 1; continue; }
    if (mode === "block-comment") { if (c === "*" && n === "/") { mode = "code"; out += "*/"; i += 2; } else { out += c; i += 1; } continue; }
    if (c === "\\") { out += c + (n ?? ""); i += 2; continue; } // escaped char stays verbatim
    if ((mode === "squote" && c === "'") || (mode === "dquote" && c === '"') || (mode === "template" && c === String.fromCharCode(96))) {
      out += c; mode = "code"; i += 1; continue;
    }
    // inside a literal: collect until terminator/escape, then translate the chunk
    let j = i;
    let chunk = "";
    while (j < src.length) {
      const cj = src[j];
      if (cj === "\\") { chunk += src.slice(j, j + 2); j += 2; continue; }
      if ((mode === "squote" && cj === "'") || (mode === "dquote" && cj === '"') || (mode === "template" && cj === String.fromCharCode(96))) break;
      chunk += cj; j += 1;
    }
    out += tr(chunk);
    i = j;
  }
  if (out !== src) { fs.writeFileSync(f, out); changedFiles += 1; }
}
console.log("changed files:", changedFiles);
const misses = map.filter(([zh]) => counts.get(zh) === 0);
console.log("keys with 0 hits:", misses.length);
for (const [zh] of misses.slice(0, 20)) console.log("  MISS:", zh.slice(0, 90));
