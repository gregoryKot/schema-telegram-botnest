#!/usr/bin/env node
// Гейт «ближайшая встреча — только через upcomingSession» (класс 17
// docs/INCIDENTS.md: «Следующее» хранится датой и стареет).
//
// `nextSession` хранит одну настенную дату, которую терапевт ввёл руками; она
// стареет, как только встреча прошла. Ближайшую встречу экраны обязаны брать
// через `shared/src/therapy/upcomingSession.ts` (дата из прошлого заменяется
// ближайшим днём из `meetingDays`). Карточка клиента показывала «Следующая
// сессия: Сб, 17 окт» 26-го числа (#867, #869); экран, бот или письмо,
// прочитавшие `nextSession` напрямую, молча назовут прошедшую дату.
//
// В `webapp/src/**`, `shared/src/**`, `src/**` (без тестов) каждое чтение
// `nextSession` обязано быть первым аргументом `upcomingSession(…)`; что
// считается чтением — `next-session-reads-rules.mjs`. Исключения —
// `EXEMPT_FILES`: им нужна сохранённая дата как есть. Бейслайна нет: класс вычищен.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { directReads } from './next-session-reads-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');

export const EXEMPT_FILES = [
  'shared/src/therapy/useSessionAliasEditing.ts', // форма правки даты
  // Сервер отдаёт дату в API как есть, ближайшую считает сайт; слияние карточки
  // и правка терапевтом переносят сохранённое значение.
  'src/therapy/therapy-relations.service.ts',
  'src/therapy/therapy-relation-info.ts',
  'src/therapy/therapy-invite-attach.ts',
  'src/therapy/therapy-client-data.service.ts',
];

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

function main() {
  const problems = [];
  for (const rel of ['webapp/src', 'shared/src', 'src'].flatMap((d) => walk(d))) {
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
        'Файл, которому нужна сохранённая дата как есть (форма правки, проброс в API), — EXEMPT_FILES с образцом в спеке.',
    );
    process.exit(1);
  }
  console.log('✓ nextSession: все чтения в сайте, shared и сервере идут через upcomingSession.');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
