#!/usr/bin/env node
// Гейт «сырой SQL исполняется на живом Postgres» (правило №18 CLAUDE.md).
//
// Инцидент 2026-09-13: запись на консультацию падала 500 на КАЖДОЙ попытке.
// `pg_advisory_xact_lock` возвращает `void`, Prisma 7 с driver-adapter не
// умеет прочитать такую колонку в `$queryRaw`. Двенадцать юнит-спеков
// бронирования были зелёными — все они мокали `$queryRaw`. Мок отвечает что
// угодно; свойство драйвера («умеет ли он прочитать ответ на ЭТОТ запрос»)
// доказывается только настоящей базой. То же для двадцати сервисов отчёта
// /stats, /health, VACUUM после удаления аккаунта, захвата списания подписки.
//
// Гейт, как и check-cron-leader.mjs, СПЕЦИАЛЬНО не ищет признак, а требует
// классификации: каждый файл src/**, где есть `$queryRaw`/`$executeRaw`/
// `$queryRawUnsafe`/`$executeRawUnsafe`/`Prisma.sql`, обязан быть в
// scripts/raw-sql-live-baseline.json:
//   { "spec": "test/x.e2e-spec.ts" }            — спек на живой базе
//       импортирует файл по пути (или, через одну ступень, файл `via`,
//       который его импортирует) И перечислен в джобе `migrations` ci.yml —
//       единственной, где поднят Postgres;
//   { "exempt": "<честная причина ≥ 20 символов>", "since": "<PR>" }.
// Протухшая запись (файл исчез / сырого SQL в нём больше нет / спека нет /
// спек не импортирует / спек не в migrations) — красная: не уборка, а сигнал
// «сверься, что произошло» (правило №16). Флага --update нет намеренно.
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'raw-sql-live-baseline.json');
const CI_PATH = join(ROOT, '.github', 'workflows', 'ci.yml');
const RAW_SQL_RE = /\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b|Prisma\.sql`/;
// Слова-отписки в exempt-причине (правило №15: исключение без разбора — то же
// замалчивание, что и обход гейта).
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function walk(dir, acc = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test-support') continue;
      walk(rel, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

/** Файлы src/** с сырым SQL (комментарии не считаются). */
export function findRawSqlFiles() {
  return walk('src').filter((rel) =>
    RAW_SQL_RE.test(stripComments(readFileSync(join(ROOT, rel), 'utf8'))),
  );
}

/** Импортирует ли файл `importer` файл `target` (по пути, без расширения). */
function importsFile(importerRel, targetRel) {
  if (!existsSync(join(ROOT, importerRel))) return false;
  const stem = basename(targetRel).replace(/\.ts$/, '');
  const re = new RegExp(`from\\s+['"][^'"]*/${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  return re.test(stripComments(readFileSync(join(ROOT, importerRel), 'utf8')));
}

/** Спеки, перечисленные в джобе `migrations` ci.yml (там поднят Postgres). */
export function migrationsJobSpecs(ciText) {
  const lines = ciText.split('\n');
  const start = lines.findIndex((l) => /^  migrations:\s*$/.test(l));
  if (start === -1) return new Set();
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z_-]+:\s*$/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start, end).join('\n');
  return new Set(body.match(/test\/[\w./-]+\.e2e-spec\.ts/g) ?? []);
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — scripts/raw-sql-live-baseline.json обязан существовать\n' +
        '(флага --update нет: классификация вносится руками, см. CLAUDE.md №18).',
    );
    process.exit(1);
    return {};
  }
}

function checkEntry(file, entry, liveSpecs, problems) {
  if (entry && typeof entry.spec === 'string') {
    if (!existsSync(join(ROOT, entry.spec))) {
      problems.push(`${file}: спек ${entry.spec} не существует`);
      return;
    }
    if (!liveSpecs.has(entry.spec)) {
      problems.push(
        `${file}: спек ${entry.spec} не перечислен в джобе migrations ci.yml — на живой базе он не гоняется`,
      );
    }
    const via = typeof entry.via === 'string' ? entry.via : null;
    const ok = via
      ? importsFile(entry.spec, via) && importsFile(via, file)
      : importsFile(entry.spec, file);
    if (!ok) {
      problems.push(
        via
          ? `${file}: цепочка ${entry.spec} → ${via} → файл не сходится по импортам`
          : `${file}: спек ${entry.spec} не импортирует этот файл — исполняться на живой базе нечему`,
      );
    }
    return;
  }
  if (entry && typeof entry.exempt === 'string') {
    const reason = entry.exempt.trim();
    if (reason.length < 20) {
      problems.push(`${file}: exempt без внятной причины (короче 20 символов)`);
      return;
    }
    const flag = REASON_RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
    if (flag) problems.push(`${file}: exempt-причина похожа на отписку (слово «${flag}»)`);
    if (!entry.since) problems.push(`${file}: exempt без since (PR/коммит решения)`);
    return;
  }
  problems.push(`${file}: запись бейслайна не {spec} и не {exempt} — неизвестная форма`);
}

function main() {
  const found = findRawSqlFiles();
  const baseline = loadBaseline();
  const liveSpecs = migrationsJobSpecs(existsSync(CI_PATH) ? readFileSync(CI_PATH, 'utf8') : '');
  const problems = [];

  const keys = Object.keys(baseline);
  const sorted = [...keys].sort();
  if (keys.some((k, i) => k !== sorted[i])) {
    problems.push('ключи scripts/raw-sql-live-baseline.json не отсортированы (правило №13: реестры держим сортированными)');
  }
  for (const file of found) {
    if (!(file in baseline)) {
      problems.push(`${file}: сырой SQL без записи в scripts/raw-sql-live-baseline.json`);
    }
  }
  for (const file of keys) {
    if (!found.includes(file)) {
      problems.push(`${file}: протухшая запись — файла нет или сырого SQL в нём больше нет (сверься, что произошло)`);
      continue;
    }
    checkEntry(file, baseline[file], liveSpecs, problems);
  }

  if (problems.length) {
    console.error('❌ Гейт «сырой SQL исполняется на живом Postgres» (CLAUDE.md №18):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nМок $queryRaw/$executeRaw отвечает что угодно; умеет ли драйвер прочитать\n' +
        'ответ на этот запрос — видно только на настоящей базе (инцидент 2026-09-13).\n' +
        'Заведи файл в scripts/raw-sql-live-baseline.json:\n' +
        '  "<файл>": { "spec": "test/<…>.e2e-spec.ts" }  — спек импортирует файл и\n' +
        '  стоит в джобе migrations ci.yml; либо, если исполнить его там нельзя:\n' +
        '  "<файл>": { "exempt": "честная причина, не отписка", "since": "<PR>" }\n' +
        'Флага --update нет — это классификация, не счётчик.',
    );
    process.exit(1);
  }
  const live = keys.filter((k) => baseline[k].spec).length;
  console.log(
    `✓ гейт живого SQL: ${found.length} файлов с сырым SQL, ${live} исполняются на живом Postgres, ${keys.length - live} исключены с причиной.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
