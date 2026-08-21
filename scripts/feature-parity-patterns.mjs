#!/usr/bin/env node
// Разбор роутов бэкенда и вызовов фронтенда для check-feature-parity.mjs —
// вынесено из движка, чтобы файл гейта не рос вместе с правилами разбора
// (правило №10 CLAUDE.md: гейт, упёршийся в потолок, дробится на движок +
// модуль правил, а не получает исключение из храповика размера).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export function walk(dir, filterFn, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist') continue;
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, filterFn, acc);
    else if (filterFn(full)) acc.push(full);
  }
  return acc;
}

// Убирает комментарии, строки не трогает (тот же приём, что в
// check-gate-exemptions.mjs) — иначе закомментированный декоратор/путь дал
// бы ложный роут или ложное упоминание идентификатора.
export function stripComments(text) {
  const n = text.length;
  let out = '', i = 0, quote = null;
  while (i < n) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(i + 2, n); out += '  '; continue;
    }
    out += c; i++;
  }
  return out;
}

// ── Роуты бэкенда: src/api/**/*.controller.ts ───────────────────────────────
const CTRL_RE = /@Controller\(\s*(?:['"]([^'"]*)['"])?\s*\)/;
const METHOD_RE = /@(Get|Post|Patch|Put|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;

function buildPath(prefix, sub) {
  const parts = [prefix, sub].filter(Boolean).join('/').split('/').filter(Boolean);
  return '/' + parts.join('/');
}
const normRoutePath = (p) => p.replace(/:[A-Za-z0-9_]+/g, ':param').replace(/\/+$/, '') || '/';

export function collectRoutes(root) {
  const files = walk(join(root, 'src/api'), (f) => f.endsWith('.controller.ts'));
  const routes = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const cm = CTRL_RE.exec(src);
    const prefix = cm ? (cm[1] ?? '') : '';
    METHOD_RE.lastIndex = 0;
    let m;
    while ((m = METHOD_RE.exec(src))) {
      const method = m[1].toUpperCase();
      const full = buildPath(prefix, m[2] ?? '');
      routes.push({ method, path: full, key: `${method} ${normRoutePath(full)}` });
    }
  }
  return routes;
}

// ── Использование во фронтендах/shared ───────────────────────────────────────
// Балансированный разбор аргументов вызова — от открывающей `(` до её пары,
// слепой к скобкам внутри строк (тот же приём, что extractBalancedArray в
// check-gate-exemptions.mjs, но для круглых, не квадратных).
function extractCallArgs(src, openIdx) {
  let depth = 0, quote = null, i = openIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(openIdx + 1, i); }
  }
  return src.slice(openIdx + 1);
}

function firstStringLiteral(argsText) {
  for (let i = 0; i < argsText.length; i++) {
    const c = argsText[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < argsText.length && argsText[j] !== c) { if (argsText[j] === '\\') j++; j++; }
      return argsText.slice(i + 1, j);
    }
    if (c === ',') return null; // первый аргумент — не литерал (переменная)
  }
  return null;
}

// `fetch(\`${base}/api/x\`, …)` — база живёт в переменной, а не в пути.
function stripLeadingTemplateVar(raw) {
  if (!raw.startsWith('${')) return raw;
  let depth = 1, j = 2;
  while (j < raw.length && depth > 0) {
    if (raw[j] === '{') depth++;
    else if (raw[j] === '}') depth--;
    j++;
  }
  return raw.slice(j);
}

// `${id}` между слэшами — path-параметр (→ :param); в хвосте без слэша после
// (напр. `/api/quizzes${form ? '?form=vy' : ''}`) — это query-суффикс, режем.
function normalizeFrontendPath(raw0) {
  const raw = stripLeadingTemplateVar(raw0);
  let out = '', i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '?') break;
    if (c === '$' && raw[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') depth--;
        j++;
      }
      const prev = out[out.length - 1], next = raw[j];
      if (prev === '/' && (next === '/' || next === undefined || next === '?')) out += ':param';
      else break;
      i = j; continue;
    }
    out += c; i++;
  }
  return out.replace(/\/+$/, '') || '/';
}

const WRAPPER_METHOD = { get: 'GET', post: 'POST', postJson: 'POST', patchJson: 'PATCH', del: 'DELETE' };
const CALL_ID_RE = /\b(get|post|postJson|patchJson|del|authedFetch|fetch)\b/g;
const PROP_KEY_RE = /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\(/g;

function skipGenericAndFindParen(src, idx) {
  let i = idx;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === '<') {
    let depth = 1; i++;
    while (i < src.length && depth > 0) { if (src[i] === '<') depth++; else if (src[i] === '>') depth--; i++; }
    while (i < src.length && /\s/.test(src[i])) i++;
  }
  return src[i] === '(' ? i : -1;
}

// Метод-обёртка (`deleteBeliefCheck: (id) => del(...)`) — ключ объекта прямо
// перед вызовом; прямой inline-вызов (authedFetch внутри хука) — ключа нет.
function nearestPropKey(src, idx, window = 220) {
  const slice = src.slice(Math.max(0, idx - window), idx);
  let last = null, m;
  PROP_KEY_RE.lastIndex = 0;
  while ((m = PROP_KEY_RE.exec(slice))) last = m[1];
  return last;
}

const nonTestSrc = (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !/\.(spec|test)\.(ts|tsx)$/.test(f);
const filesOf = (root, tree) => walk(join(root, tree), nonTestSrc);

export function scanUsage(root, tree) {
  const matches = [];
  for (const file of filesOf(root, tree)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    CALL_ID_RE.lastIndex = 0;
    let m;
    while ((m = CALL_ID_RE.exec(src))) {
      const parenIdx = skipGenericAndFindParen(src, m.index + m[1].length);
      if (parenIdx === -1) continue;
      const argsText = extractCallArgs(src, parenIdx);
      const lit = firstStringLiteral(argsText);
      if (lit === null) continue;
      const stripped = stripLeadingTemplateVar(lit);
      if (!stripped.startsWith('/api/') && !stripped.startsWith('/health')) continue;
      let method;
      if (m[1] === 'authedFetch' || m[1] === 'fetch') {
        const mm = /method\s*:\s*['"]([A-Za-z]+)['"]/.exec(argsText);
        method = mm ? mm[1].toUpperCase() : 'GET';
      } else {
        method = WRAPPER_METHOD[m[1]];
      }
      matches.push({
        key: `${method} ${normalizeFrontendPath(lit)}`,
        propKey: nearestPropKey(src, m.index),
      });
    }
  }
  return matches;
}

const corpusCache = new Map();
function corpusFor(root, tree) {
  const cacheKey = `${root}::${tree}`;
  if (!corpusCache.has(cacheKey)) {
    corpusCache.set(
      cacheKey,
      filesOf(root, tree).map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n'),
    );
  }
  return corpusCache.get(cacheKey);
}
function countIdentifier(root, tree, ident) {
  const re = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  return (corpusFor(root, tree).match(re) ?? []).length;
}

// Объявление без ключа (прямой вызов) — используется по определению.
// С ключом — нужно ≥2 упоминаний идентификатора (объявление + хоть один
// реальный вызывающий) в своём дереве ИЛИ в shared: shared-хуки с
// прокинутыми зависимостями (напр. useWarmWords) не обязаны звать метод
// через `api.` дословно — им достаточно упомянуть имя поля хоть раз.
function isReallyUsed(root, match, tree) {
  if (!match.propKey) return true;
  return countIdentifier(root, tree, match.propKey) + countIdentifier(root, 'shared/src', match.propKey) >= 2;
}

function accessibleSet(root, ownMatches, ownTree, sharedMatches) {
  const set = new Set();
  for (const mt of ownMatches) if (isReallyUsed(root, mt, ownTree)) set.add(mt.key);
  for (const mt of sharedMatches) if (isReallyUsed(root, mt, 'shared/src')) set.add(mt.key);
  return set;
}

// ── Классификация ────────────────────────────────────────────────────────────
export function classify(root) {
  const routes = collectRoutes(root);
  const webappM = scanUsage(root, 'webapp/src');
  const miniappM = scanUsage(root, 'schema-miniapp/src');
  const sharedM = scanUsage(root, 'shared/src');
  const web = accessibleSet(root, webappM, 'webapp/src', sharedM);
  const mini = accessibleSet(root, miniappM, 'schema-miniapp/src', sharedM);
  return routes.map((r) => {
    const inWeb = web.has(r.key), inMini = mini.has(r.key);
    const status = inWeb && inMini ? 'both' : inWeb ? 'webapp-only' : inMini ? 'miniapp-only' : 'nobody';
    return { ...r, status };
  });
}
