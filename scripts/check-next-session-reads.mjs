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
// считается чтением — `next-session-reads-rules.mjs`. Исключения — `ALLOWED_READS`:
// местам, которым нужна сохранённая дата как есть. Ключ места — файл и имя
// ближайшей именованной функции (не номер строки: правка выше его не сдвигает),
// `count` — сколько чтений там разрешено. Счёт сверяется точно: новое чтение в той
// же функции, в другой функции того же файла или исчезнувшее место — красный.
// Бейслайна нет: класс вычищен.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readSites } from './next-session-reads-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');

export const ALLOWED_READS = [
  // Форма правки даты: поле заполняется сохранённым значением.
  { file: 'shared/src/therapy/useSessionAliasEditing.ts', fn: 'resetSessionAlias', count: 1 },
  // Сервер отдаёт дату в API как есть, ближайшую считает сайт; слияние карточки
  // и правка терапевтом переносят сохранённое значение.
  { file: 'src/therapy/therapy-relations.service.ts', fn: 'getClients', count: 2 },
  { file: 'src/therapy/therapy-relation-info.ts', fn: 'getRelationInfo', count: 1 },
  { file: 'src/therapy/therapy-invite-attach.ts', fn: 'attachOfflineCard', count: 2 },
  { file: 'src/therapy/therapy-client-data.service.ts', fn: 'updateSessionInfo', count: 2 },
];

function walk(rel, acc = []) {
  if (!existsSync(join(ROOT, rel))) return acc;
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) {
      if (!name.startsWith('.') && !['node_modules', 'dist', 'test-support'].includes(name)) walk(r, acc);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|test-helpers/.test(name)) acc.push(r);
  }
  return acc;
}

/** Находки файла: чтения вне разрешённых мест и места, где счёт не совпал. */
export function judgeFile(rel, sites, allowed = ALLOWED_READS) {
  const problems = [];
  const byFn = new Map();
  for (const s of sites) byFn.set(s.fn, [...(byFn.get(s.fn) ?? []), s.line]);
  const mine = allowed.filter((a) => a.file === rel);
  for (const [fn, lines] of byFn) {
    const entry = mine.find((a) => a.fn === fn);
    if (!entry) {
      for (const line of lines) problems.push(`${rel}:${line}: nextSession читается мимо upcomingSession`);
    } else if (entry.count !== lines.length) {
      problems.push(
        `${rel}:${lines[0]}: в ${fn} чтений nextSession ${lines.length}, разрешено ${entry.count} (ALLOWED_READS)`,
      );
    }
  }
  for (const entry of mine) {
    if (!byFn.has(entry.fn)) {
      problems.push(`${rel}: в ${entry.fn} чтений nextSession нет, а разрешено ${entry.count} — снимите запись ALLOWED_READS`);
    }
  }
  return problems;
}

function main() {
  const problems = [];
  for (const rel of ['webapp/src', 'shared/src', 'src'].flatMap((d) => walk(d))) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    const sites = raw.includes('nextSession') ? readSites(raw) : [];
    problems.push(...judgeFile(rel, sites));
  }
  if (problems.length) {
    console.error('❌ Прямое чтение nextSession (класс 17 INCIDENTS: «следующее» стареет):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nБлижайшая встреча — upcomingSession(x.nextSession, x.meetingDays)\n' +
        '(shared/src/therapy/upcomingSession.ts): прошедшая дата заменяется ближайшим днём встреч.\n' +
        'Месту, которому нужна сохранённая дата как есть (форма правки, проброс в API), — запись\n' +
        'ALLOWED_READS { file, fn, count } с образцом в спеке.',
    );
    process.exit(1);
  }
  console.log('✓ nextSession: все чтения в сайте, shared и сервере идут через upcomingSession.');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
