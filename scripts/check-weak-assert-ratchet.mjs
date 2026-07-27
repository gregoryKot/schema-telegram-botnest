#!/usr/bin/env node
// Храповик слабых тестов (TEST_IMPROVEMENT_PLAN.md, этап 3.1). Аудит нашёл
// ~171 бэкенд-тест, который ассертит ТОЛЬКО .toHaveBeenCalled()/
// .toHaveBeenCalledTimes(n) без проверки аргументов/результата — такой тест
// зелёный, даже если хендлер вызвал мок с мусорными аргументами или не тем
// объектом. Правило без гейта не работает (см. правила №9/№10 CLAUDE.md) —
// счётчик weak-тестов сравнивается с закоммиченным бейслайном, рост роняет
// CI, снижение — обнови бейслайн:
//   node scripts/check-weak-assert-ratchet.mjs --update
//
// Определение weak-теста: it()/test()-блок в src/**/*.spec.ts, в теле
// которого есть хотя бы один expect(), и ВСЕ expect() в блоке — голые
// .toHaveBeenCalled() / .toHaveBeenCalledTimes(n) (с необязательным .not
// перед матчером), без .toHaveBeenCalledWith(...) и без любых других
// матчеров. Блоки-хендлеры вытаскиваются скобочным балансом (аналог
// handlerBlocks в src/security/csrf.invariants.spec.ts, но с учётом строк/
// шаблонных литералов/комментариев, а не split по регэксу).
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'weak-assert-baseline.json');
const UPDATE = process.argv.includes('--update');

function listSpecFiles() {
  const res = spawnSync('git', ['ls-files', 'src'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error('❌ git ls-files не отработал:\n' + (res.stderr || ''));
    process.exit(1);
  }
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .filter((p) => p.endsWith('.spec.ts'));
}

// Находит индекс закрывающей скобки openChar/closeChar, начиная с indexOf
// открывающей скобки (openIdx), с учётом строк ('/"/`), их экранирования и
// однострочных/блочных комментариев — иначе '{' или '(' внутри строки-
// литерала сбивает баланс.
function findMatchingBracket(text, openIdx, openChar, closeChar) {
  let depth = 0;
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && text[i + 1] === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      inBlockComment = true;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Находит стартовые позиции вызовов it(...)/test(...), включая
// .only/.skip/.todo/.concurrent и .each(array)(...)/.each`template`(...).
// Возвращает индекс открывающей '(' самого вызова (name, callback).
const TEST_FN = /\b(?:it|test)(\.(?:only|skip|todo|concurrent|each))?/g;

function skipWs(text, idx) {
  while (idx < text.length && /\s/.test(text[idx])) idx++;
  return idx;
}

function findTestCallStarts(text) {
  const starts = [];
  let m;
  TEST_FN.lastIndex = 0;
  while ((m = TEST_FN.exec(text))) {
    let idx = skipWs(text, TEST_FN.lastIndex);
    if (m[1] === '.each') {
      if (text[idx] === '(') {
        const close = findMatchingBracket(text, idx, '(', ')');
        if (close === -1) continue;
        idx = close + 1;
      } else if (text[idx] === '`') {
        let j = idx + 1;
        while (j < text.length && text[j] !== '`') {
          if (text[j] === '\\') j++;
          j++;
        }
        idx = j + 1;
      } else {
        continue;
      }
      idx = skipWs(text, idx);
    }
    if (text[idx] !== '(') continue;
    starts.push(idx);
    TEST_FN.lastIndex = idx;
  }
  return starts;
}

// Внутри диапазона аргументов вызова (argsOpenIdx..argsCloseIdx) ищет тело
// callback-функции: первое `=> {` (стрелочная) или `function ... {`.
// Название теста (первый аргумент) — строковый литерал, поэтому первое
// совпадение принадлежит именно callback-у, а не тексту имени.
function findCallbackBody(text, argsOpenIdx, argsCloseIdx) {
  const span = text.slice(argsOpenIdx, argsCloseIdx);
  const arrow = span.match(/=>\s*\{/);
  const func = span.match(/\bfunction\b[^{]*\{/);
  let braceRelIdx = -1;
  if (arrow && (!func || arrow.index <= func.index)) {
    braceRelIdx = arrow.index + arrow[0].length - 1;
  } else if (func) {
    braceRelIdx = func.index + func[0].length - 1;
  }
  if (braceRelIdx === -1) return null;
  const braceIdx = argsOpenIdx + braceRelIdx;
  const closeBrace = findMatchingBracket(text, braceIdx, '{', '}');
  if (closeBrace === -1 || closeBrace > argsCloseIdx) return null;
  return { start: braceIdx + 1, end: closeBrace, headEnd: braceIdx };
}

function findBlocks(text) {
  const blocks = [];
  for (const argsOpenIdx of findTestCallStarts(text)) {
    const argsCloseIdx = findMatchingBracket(text, argsOpenIdx, '(', ')');
    if (argsCloseIdx === -1) continue;
    const cb = findCallbackBody(text, argsOpenIdx, argsCloseIdx);
    if (!cb) continue; // it.todo(...) / it(name) без callback-тела
    blocks.push({
      name: text.slice(argsOpenIdx, Math.min(cb.headEnd, argsOpenIdx + 120)),
      body: text.slice(cb.start, cb.end),
    });
  }
  return blocks;
}

// Матчер сразу после expect(...): пропускает цепочку .not/.resolves/.rejects,
// возвращает имя финального матчера.
const MODIFIER_CHAIN = /^(?:\s*\.(?:not|resolves|rejects))*\s*\.(\w+)\(/;
const WEAK_MATCHERS = new Set(['toHaveBeenCalled', 'toHaveBeenCalledTimes']);

function classifyExpects(body) {
  const results = [];
  const re = /\bexpect\s*\(/g;
  let m;
  while ((m = re.exec(body))) {
    const openParenIdx = m.index + m[0].length - 1;
    const closeParenIdx = findMatchingBracket(body, openParenIdx, '(', ')');
    if (closeParenIdx === -1) continue;
    const rest = body.slice(closeParenIdx + 1);
    const chainMatch = rest.match(MODIFIER_CHAIN);
    if (!chainMatch) {
      // expect(...) без распознанного матчера следом (напр. многострочный
      // перенос .not\n.toBe(...) — консервативно считаем «сильным», чтобы
      // не плодить ложных weak).
      results.push({ weak: false, matcher: null });
      continue;
    }
    results.push({
      weak: WEAK_MATCHERS.has(chainMatch[1]),
      matcher: chainMatch[1],
    });
    re.lastIndex = closeParenIdx + 1;
  }
  return results;
}

function findWeakBlocks(file, text) {
  const weak = [];
  for (const block of findBlocks(text)) {
    const expects = classifyExpects(block.body);
    if (expects.length === 0) continue;
    if (expects.every((e) => e.weak)) {
      weak.push({ file, name: block.name.trim() });
    }
  }
  return weak;
}

const files = listSpecFiles();
const allWeak = [];
const byFile = {};
for (const f of files) {
  const text = readFileSync(join(ROOT, f), 'utf8');
  const weak = findWeakBlocks(f, text);
  if (weak.length) {
    byFile[f] = weak.length;
    allWeak.push(...weak);
  }
}

const total = allWeak.length;

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ total }, null, 2) + '\n');
  console.log(`Бейслайн обновлён: ${total} weak-тестов.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-weak-assert-ratchet.mjs --update',
  );
  process.exit(1);
}

if (total > baseline.total) {
  console.error(
    `❌ weak-assert-храповик: счётчик слабых тестов вырос ${baseline.total} → ${total}.`,
  );
  console.error('Файлы с weak-тестами (топ по количеству):');
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.error(`   ${f}: ${n}`);
  }
  console.error(
    'Weak-тест — expect() только на голые .toHaveBeenCalled()/.toHaveBeenCalledTimes(n),\n' +
      'без проверки аргументов/результата. Замени на .toHaveBeenCalledWith(...) с реальными\n' +
      'ожидаемыми аргументами и/или добавь ассерт на результат.\n' +
      'Бейслайн обновляется только вниз: node scripts/check-weak-assert-ratchet.mjs --update',
  );
  process.exit(1);
}

console.log(
  total < baseline.total
    ? `✓ weak-assert-храповик: ${total} < ${baseline.total} — стало лучше, зафиксируй: node scripts/check-weak-assert-ratchet.mjs --update`
    : `✓ weak-assert-храповик: ${total} (без роста)`,
);
