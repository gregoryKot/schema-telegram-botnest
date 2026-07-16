#!/usr/bin/env node
// Детектор коллизий HTTP-маршрутов (аудит 2026-07, свип дублей).
//
// Найдено в проде: GET/POST /api/settings и GET /api/therapy/client/:id/
// {schema,mode}-notes были зарегистрированы в ДВУХ контроллерах с разными
// реализациями — отвечала та, чей модуль импортирован раньше, вторая была
// мёртвым кодом (а в случае notes — с потерянной privacy-проверкой).
// Nest на дубли не ругается, поэтому — CI-гейт.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.controller.ts')) yield p;
  }
}

const routes = {};
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const ctrl = (src.match(/@Controller\('([^']*)'\)/) ?? [])[1] ?? '';
  for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/g)) {
    // :param-сегменты нормализуем — /a/:id и /a/:key это один слот.
    const path = [ctrl, m[2] ?? '']
      .filter(Boolean)
      .join('/')
      .replace(/:[^/]+/g, ':*');
    const route = `${m[1].toUpperCase()} /${path}`;
    (routes[route] ??= []).push(relative(ROOT, file));
  }
}

let failed = false;
for (const [route, files] of Object.entries(routes)) {
  if (files.length > 1) {
    failed = true;
    console.error(`❌ маршрут-дубль: ${route}\n   ${files.join('\n   ')}`);
  }
}
if (failed) {
  console.error(
    'Один маршрут — один контроллер. Отвечает тот, чей модуль импортирован\n' +
      'раньше; второй — мёртвый код с риском разъехавшейся логики.',
  );
  process.exit(1);
}
console.log(`✓ коллизий маршрутов нет (${Object.keys(routes).length} маршрутов)`);
