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
// Что ловит в `src/**/*.ts` (без спеков и test-support): адрес отправки,
// приведённый из id аккаунта, — у самой отправки и у вызывающих любой функции,
// чей параметр доходит до адреса, в том числе из другого файла. Что считается
// адресом и как идёт разбор через параметр — `telegram-chat-id-flow.mjs`.
// Поиск по карте (`chatIds.get(uid.toString())`) и вызов `telegramIdFor(…)`
// законны. Бейслайна нет: класс вычищен целиком. Исключения — `EXEMPT_FILES`:
// их отправки не проверяются, но их функции-отправщики разбираются.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { findViolations } from './telegram-chat-id-flow.mjs';

const ROOT = resolve(import.meta.dirname, '..');

export const EXEMPT_FILES = ['src/auth/telegram-identity.ts', 'src/bot/account.service.ts'];

function walk(rel, acc = []) {
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'test-support') walk(r, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$|\.d\.ts$/.test(name)) acc.push(r);
  }
  return acc;
}

function main() {
  const files = walk('src').map((rel) => ({
    rel,
    src: stripComments(readFileSync(join(ROOT, rel), 'utf8')),
    report: !EXEMPT_FILES.includes(rel),
  }));
  const problems = findViolations(files).map(
    (v) => `${v.rel}:${v.line}: адрес отправки «${v.expr}» — id аккаунта, а не чат${v.via ? ` (через ${v.via})` : ''}`,
  );
  if (problems.length) {
    console.error('❌ chat_id из userId вне telegram-identity (класс #456):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nuserId — чат только у телеграм-входа; у почты, Google, MAX и после слияния — нет.\n' +
        'Адрес берётся из AuthProvider: telegramIdFor / telegramIdsFor (src/auth/telegram-identity.ts);\n' +
        'null — писать некуда (не «заблокировал бота»). «через X» — адрес дошёл до отправки параметром функции X.',
    );
    process.exit(1);
  }
  console.log('✓ адреса в Telegram: отправок по сырому userId нет, в том числе через параметры.');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
