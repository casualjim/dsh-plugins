#!/usr/bin/env node
// List CJK string-literal lines in src/ (comment-only lines skipped). Audit lever after syncs.
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname, "src");
function walk(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(f.name)) out.push(p);
  }
  return out;
}
const hits = [];
for (const f of walk(ROOT)) {
  if (f.includes(path.join(ROOT, "client", "locales.ts"))) continue; // zh dict is key source
  const lines = fs.readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/[\u4e00-\u9fff]/.test(l)) continue;
    const code = l.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (code.trim().startsWith("*") || code.trim().startsWith("/*")) continue; // JSDoc body
    if (!/[\u4e00-\u9fff]/.test(code)) continue;
    hits.push(path.relative(ROOT, f) + ":" + (i + 1) + ": " + code.trim().slice(0, 150));
  }
}
console.log("CJK code lines:", hits.length);
console.log(hits.join("\n"));
