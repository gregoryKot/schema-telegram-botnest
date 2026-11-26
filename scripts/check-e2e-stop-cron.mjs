#!/usr/bin/env node
// Гейт: тест, поднимающий AppModule, гасит его настоящие @Cron —
// `stopCronJobs(app)` из test/e2e-support/stop-cron-jobs.ts после `app.init()`.
//
// Откуда: AppModule подключает ScheduleModule.forRoot(), и после init все
// @Cron проекта тикают посреди спека. Тик sendReminders (*/5) на границе
// пятиминутки слал напоминания по броням из общей БД джобы `migrations`, и
// счётчик шпиона «ровно 1 DM» видел 4 (CI PR #722, 2026-10-16). Тогда крон
// погасили в одном спеке, остальные держались ревью. Теперь `stopCronJobs`
// зовут оба строителя (build-test-app.ts, build-real-db-test-app.ts), и через
// них — каждый e2e. Гейт держит обход: новый файл, собравший AppModule сам.
//
// Что смотрит: `test/**/*.ts` и `src/**/*.spec.ts` (боевой `src/main.ts`
// поднимает AppModule законно). Файл «поднимает AppModule», если в коде (без
// комментариев) импортирует модуль `…/app.module`. Красное:
//   (а) в таком файле нет вызова `stopCronJobs(`;
//   (б) вызов стоит раньше последнего `.init(` — до init задач в реестре ещё
//       нет, гасить нечего;
//   (в) ни один файл AppModule не поднимает — гейт смотрит не туда (строители
//       переехали), а молчание читалось бы как «всё чисто».
// Бейслайна нет: законных исключений сегодня нет, а спеку, которому нужно
// живое расписание, проще позвать сам метод крона.
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const SCAN = [
  { dir: 'test', pick: (name) => name.endsWith('.ts') },
  { dir: 'src', pick: (name) => name.endsWith('.spec.ts') },
];

// Импорт — инструкция кода: статический с начала строки, динамический или
// require без кавычки левее на строке. Строка-фикстура в тесте гейта
// (`"import { AppModule } from '…/app.module'"`) импортом не считается.
const APP_MODULE = String.raw`['"][^'"\n]*\/app\.module(?:\.ts)?['"]`;
const APP_MODULE_IMPORT = [
  new RegExp(String.raw`^\s*import\b[^;]*?\bfrom\s*` + APP_MODULE, 'm'),
  new RegExp(String.raw`^[^'"\x60\n]*\b(?:import|require)\s*\(\s*` + APP_MODULE, 'm'),
];
const STOP_CALL = /\bstopCronJobs\s*\(/g;
const INIT_CALL = /\.init\s*\(/g;

/** Комментарии `//` и `/* *\/` — пояснения, а не код. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

const lastIndex = (re, text) => {
  let last = -1;
  for (const m of text.matchAll(re)) last = m.index;
  return last;
};

/** Нарушение в одном файле или null. */
export function checkSource(text) {
  const code = stripComments(text);
  if (!APP_MODULE_IMPORT.some((re) => re.test(code))) return null;
  const stop = lastIndex(STOP_CALL, code);
  if (stop < 0) return 'поднимает AppModule без stopCronJobs(app)';
  if (stop < lastIndex(INIT_CALL, code)) return 'stopCronJobs стоит раньше app.init() — гасить ещё нечего';
  return 'ok';
}

function walk(dir, pick, out = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = join(dir, e.name);
    if (e.isDirectory()) walk(rel, pick, out);
    else if (pick(e.name)) out.push(rel);
  }
  return out;
}

function main() {
  const files = SCAN.flatMap(({ dir, pick }) => walk(dir, pick)).sort();
  const booting = [];
  const problems = [];
  for (const file of files) {
    const verdict = checkSource(readFileSync(join(ROOT, file), 'utf8'));
    if (verdict === null) continue;
    booting.push(file);
    if (verdict !== 'ok') problems.push(`${file}: ${verdict}`);
  }
  if (booting.length === 0) {
    problems.push('ни один файл в test/ и src/**/*.spec.ts не импортирует app.module — строители e2e переехали, гейт смотрит не туда');
  }
  if (problems.length) {
    console.error('❌ гейт кронов e2e: настоящие @Cron тикают посреди спека');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      'Позови `await stopCronJobs(app)` (test/e2e-support/stop-cron-jobs.ts) сразу после app.init()\n' +
        'или подними приложение через buildTestApp/buildRealDbTestApp — они это уже делают.',
    );
    process.exit(1);
  }
  console.log(`✓ гейт кронов e2e: ${booting.length} файл(а) поднимают AppModule, все гасят @Cron (${booting.join(', ')}).`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
