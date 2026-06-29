#!/usr/bin/env node
// i18n coverage guard. Fails the build if a Cyrillic string/template literal
// appears anywhere in src/ OUTSIDE src/i18n/. That can only mean a player-facing
// string was hard-coded instead of going through the catalog (t('m_...')) — the
// exact bug class where a button silently shipped in Russian.
//
// Completeness (every key has ru+en) is already guaranteed at compile time by the
// `satisfies` in messages.ts. This guard guarantees coverage (nothing escapes it).
//
// Escape hatches: add `// i18n-ignore` on the line, or extend ALLOW below.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const CYR = /[А-Яа-яЁё]/;
// Intentional, non-translatable literals (glyph sample for font preload; the
// language-toggle button shows the *name* of each language, not a translation).
const ALLOW = new Set(['Йо', 'РУ']);

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (!p.endsWith(path.sep + 'i18n')) walk(p); }
    else if (f.endsWith('.ts') && !f.endsWith('.d.ts')) files.push(p);
  }
})(ROOT);

const violations = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (inBlock) { if (trimmed.includes('*/')) inBlock = false; continue; }
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('/*')) { if (!trimmed.includes('*/')) inBlock = true; continue; }
    if (line.includes('i18n-ignore')) continue;
    const code = line.replace(/\/\/.*$/, ''); // drop trailing line comment
    const lits = code.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g) || [];
    for (const lit of lits) {
      const inner = lit.slice(1, -1);
      if (CYR.test(lit) && !ALLOW.has(inner)) {
        violations.push(`${path.relative(path.join(__dirname, '..'), file)}:${i + 1}  ${lit.trim().slice(0, 60)}`);
      }
    }
  }
}

if (violations.length) {
  console.error('\n✖ i18n coverage: hard-coded Cyrillic string(s) found outside src/i18n/.');
  console.error('  Move the text into src/i18n/messages.ts and use t(\'m_...\').');
  console.error('  (Intentional? add `// i18n-ignore` on the line or extend ALLOW.)\n');
  for (const v of violations) console.error('  ' + v);
  console.error('');
  process.exit(1);
}
console.log(`✓ i18n coverage: ${files.length} files clean — no hard-coded Cyrillic outside src/i18n/.`);
