#!/usr/bin/env node
// Гейт «адрес в Telegram — только из AuthProvider» (класс инцидента #456).
//
// userId равен telegramId только у телеграм-входа. У входа через Google, почту
// и MAX userId лежит в веб-диапазоне, а после слияния аккаунтов строка
// источника удалена — telegramId живёт только в AuthProvider. Отправка
// `sendMessage(Number(userId), …)` в таком случае уходит в никуда или чужому
// чату (2026-08-30: уведомления уходили в никуда, #456;
// `therapist-request.notify.ts` был последним сырым `sendTg(userId)`).
// Единственное место, где из userId получается chat_id, —
// `src/auth/telegram-identity.ts` (`telegramIdFor`, `telegramIdsFor`) и его
// обёртка `src/bot/account.service.ts`.
//
// Что ловит в `src/**/*.ts` (без спеков и test-support): адрес отправки в
// Telegram — первый аргумент `.sendMessage(`/`.sendPhoto(`/… и `sendTg(`,
// второй аргумент `sendBounded(бот, адрес, …)`, значение `chat_id:` — это
// прямое приведение id аккаунта: `userId`, `x.userId`, `user.id`, `uid`, в
// том числе через `Number()`/`String()`/`BigInt()`/`.toString()`, сразу или
// через одну переменную (`const chatId = Number(userId)`). Поиск по карте
// (`chatIds.get(uid.toString())`) и вызов `telegramIdFor(…)` законны.
// Бейслайна нет: класс вычищен целиком. Исключения — `EXEMPT_FILES` выше.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { matchParen, lineAt, skipString } from './gate-balance.mjs';

const ROOT = resolve(import.meta.dirname, '..');

export const EXEMPT_FILES = ['src/auth/telegram-identity.ts', 'src/bot/account.service.ts'];

const SEND_RE = /\.(?:sendMessage|sendPhoto|sendDocument|sendVideo|sendAnimation|sendMediaGroup|sendChatAction|copyMessage|forwardMessage)\s*\(|\bsendTg\s*\(|\bsendBounded\s*\(/g;
const ACCOUNT_ID = String.raw`(?:[\w$.]*\.userId|userId|uid|user\.id)`;
export const DIRECT_RE = new RegExp(
  String.raw`^(?:(?:Number|String|BigInt)\(\s*${ACCOUNT_ID}\s*\)|${ACCOUNT_ID}(?:\.toString\(\))?)$`,
);

function walk(rel, acc = []) {
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'test-support') walk(r, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$|\.d\.ts$/.test(name)) acc.push(r);
  }
  return acc;
}

/** Аргументы вызова верхнего уровня (без вложенных скобок). */
function args(src, open) {
  const close = matchParen(src, open);
  if (close === -1) return [];
  const out = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < close; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) { out.push(src.slice(start, i).trim()); start = i + 1; }
  }
  out.push(src.slice(start, close).trim());
  return out;
}

/** Адрес — id аккаунта: напрямую или через одну переменную файла. */
function isAccountId(expr, src) {
  const e = expr.replace(/\s+/g, ' ').trim();
  if (DIRECT_RE.test(e)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(e)) return false;
  const decl = new RegExp(String.raw`\b(?:const|let|var)\s+${e}\s*(?::[^=]+)?=\s*([^;\n]+)`).exec(src);
  return !!decl && DIRECT_RE.test(decl[1].trim());
}

export function findViolations(rawSrc) {
  const src = stripComments(rawSrc);
  const found = [];
  for (const m of src.matchAll(SEND_RE)) {
    const list = args(src, m.index + m[0].length - 1);
    const target = /sendBounded/.test(m[0]) ? list[1] : list[0];
    if (target && isAccountId(target, src)) found.push({ line: lineAt(src, m.index), expr: target });
  }
  for (const m of src.matchAll(/\bchat_id\s*:\s*([^,}\n]+)/g)) {
    if (isAccountId(m[1], src)) found.push({ line: lineAt(src, m.index), expr: m[1].trim() });
  }
  return found;
}

function main() {
  const problems = [];
  for (const rel of walk('src')) {
    if (EXEMPT_FILES.includes(rel)) continue;
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!/send|chat_id/.test(raw)) continue;
    for (const v of findViolations(raw)) problems.push(`${rel}:${v.line}: адрес отправки «${v.expr}» — id аккаунта, а не чат`);
  }
  if (problems.length) {
    console.error('❌ chat_id из userId вне telegram-identity (класс #456):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nuserId — чат только у телеграм-входа; у почты, Google, MAX и после слияния — нет.\n' +
        'Адрес берётся из AuthProvider: telegramIdFor / telegramIdsFor (src/auth/telegram-identity.ts);\n' +
        'null — писать некуда (не «заблокировал бота»).',
    );
    process.exit(1);
  }
  console.log('✓ адреса в Telegram: отправок по сырому userId нет.');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
