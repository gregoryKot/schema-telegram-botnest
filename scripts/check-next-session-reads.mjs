#!/usr/bin/env node
// Гейт «ближайшая встреча — только через upcomingSession» (класс 17
// docs/INCIDENTS.md: «Следующее» хранится датой и стареет).
//
// `nextSession` хранит одну настенную дату, которую терапевт ввёл руками; она
// стареет, как только встреча прошла. Ближайшую встречу экраны обязаны брать
// через `shared/src/therapy/upcomingSession.ts` (дата из прошлого заменяется
// ближайшим днём из `meetingDays`). Карточка клиента показывала «Следующая
// сессия: Сб, 17 окт» 26-го числа (#867, #869); пятый экран, прочитавший
// `relation.nextSession` напрямую, молча вернул бы прошедшую дату — держали
// только тесты четырёх экранов.
//
// В `webapp/src/**`, `shared/src/**` (без тестов) каждое чтение `.nextSession`
// / `?.nextSession` обязано быть первым аргументом `upcomingSession(…)`;
// деструктуризация в объявлении (`const { nextSession } = …`) — тоже чтение. Запись
// (`x.nextSession = …`, ключ объекта `{ nextSession: … }`) и типы не
// считаются. Исключения — `EXEMPT_FILES`: форма правки показывает сохранённую
// дату как есть, чтобы её поправить. Бейслайна нет: класс вычищен.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { lineAt } from './gate-balance.mjs';

const ROOT = resolve(import.meta.dirname, '..');

export const EXEMPT_FILES = ['shared/src/therapy/useSessionAliasEditing.ts'];

function walk(rel, acc = []) {
  if (!existsSync(join(ROOT, rel))) return acc;
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) {
      if (!['node_modules', 'dist', 'test-support'].includes(name)) walk(r, acc);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|test-helpers/.test(name)) acc.push(r);
  }
  return acc;
}

/** Прямые чтения nextSession мимо upcomingSession: номера строк. */
export function directReads(rawSrc) {
  const src = stripComments(rawSrc);
  const lines = [];
  for (const m of src.matchAll(/\??\.nextSession\b/g)) {
    const before = src.slice(0, m.index);
    const after = src.slice(m.index + m[0].length);
    if (/upcomingSession\s*\(\s*[\w$?.[\]]*$/.test(before)) continue;
    if (/^\s*=(?!=)/.test(after)) continue;
    lines.push(lineAt(src, m.index));
  }
  // Деструктуризация в объявлении: `const { nextSession } = rel`, `let { nextSession: ns } = …`.
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{[^{}]*\bnextSession\b[^{}]*\}\s*(?::[^=]+)?=(?!=)/g)) {
    lines.push(lineAt(src, m.index));
  }
  return [...new Set(lines)].sort((a, b) => a - b);
}

function main() {
  const problems = [];
  for (const rel of [...walk('webapp/src'), ...walk('shared/src')]) {
    if (EXEMPT_FILES.includes(rel)) continue;
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('nextSession')) continue;
    for (const line of directReads(raw)) problems.push(`${rel}:${line}: nextSession читается мимо upcomingSession`);
  }
  if (problems.length) {
    console.error('❌ Прямое чтение nextSession (класс 17 INCIDENTS: «следующее» стареет):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nБлижайшая встреча — upcomingSession(x.nextSession, x.meetingDays)\n' +
        '(shared/src/therapy/upcomingSession.ts): прошедшая дата заменяется ближайшим днём встреч.\n' +
        'Форма правки, которой нужна сохранённая дата как есть, — EXEMPT_FILES с образцом в спеке.',
    );
    process.exit(1);
  }
  console.log('✓ nextSession: все чтения во фронтах идут через upcomingSession.');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
