#!/usr/bin/env node
// Гейт «фикстура как у настоящей площадки» (CLAUDE.md, правило №14).
//
// Два из трёх последних инцидентов CalDAV (PR #491, PR #494) — один класс:
// парсер внешнего формата тестировался на фикстуре, которую выдумал сам
// автор, а не на том, что реально присылает площадка. `git show b4141e1`
// (PR #494) — образец починки: PROPFIND-ответ iCloud перенесён в
// test/fixtures/recorded/ (не выдуман, а восстановлен по разбору обоих
// инцидентов).
//
// Гейт не ищет один признак («похоже на парсер») — он находит КАЖДЫЙ файл,
// подходящий под известные классы парсеров внешнего формата, и требует
// явной классификации в scripts/recorded-fixtures-baseline.json:
//   "recorded" — есть реально записанная фикстура, и спек её читает;
//   "exempt"   — записи с площадки нет (честный долг, не нарушение —
//                см. правило №15: не сочиняй фикстуру, просто признай долг).
// Флага --update нет: это классификация решения человека, не счётчик долга
// (тот же принцип, что у check-cron-leader.mjs).
//
//   node scripts/check-recorded-fixtures.mjs [--verbose]
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PARSER_PATH_PATTERNS } from './recorded-fixtures-patterns.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'recorded-fixtures-baseline.json');
const FIXTURES_DIR = join(ROOT, 'test', 'fixtures', 'recorded');
const VERBOSE = process.argv.includes('--verbose');
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

// Сигналы содержимого — файл вне PARSER_PATH_PATTERNS всё равно кандидат,
// если он одновременно (а) ходит во внешнюю площадку и (б) разбирает её
// ответ, либо (в) проверяет подпись/токен, присланные извне (initData,
// OAuth id_token) — второе не требует исходящего запроса вовсе.
const EXTERNAL_CALL = /\bfetch\(|\baxios\.\w+\(|\bhttps\.request\(/;
const RESPONSE_PARSE = /\.json\(\)|JSON\.parse\(|DOMParser\(|parseStringPromise\(/;
const EXTERNAL_SIGNATURE = /createHmac\(|jwtVerify\(|decodeJwt\(|createRemoteJWKSet\(/;

function isSpec(rel) {
  return /\.(spec|test)\.ts$/.test(rel);
}

function walkSrc(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc; // песочница без src/ вовсе — валидный пустой случай
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test-support') continue;
      walkSrc(rel, acc);
    } else if (/\.ts$/.test(name) && !isSpec(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

/** Явные классы парсеров по расположению файла (CLAUDE.md-описание задачи). */
function matchesExplicitPath(rel) {
  return PARSER_PATH_PATTERNS.some((re) => re.test(rel));
}

function matchesContentSignal(src) {
  if (EXTERNAL_SIGNATURE.test(src)) return true;
  return EXTERNAL_CALL.test(src) && RESPONSE_PARSE.test(src);
}

function findParsers() {
  const found = [];
  for (const rel of walkSrc('src')) {
    const byPath = matchesExplicitPath(rel);
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const byContent = !byPath && matchesContentSignal(src);
    if (byPath || byContent) found.push({ rel, reason: byPath ? 'path' : 'content' });
  }
  return found;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(
      'Нет бейслайна — scripts/recorded-fixtures-baseline.json обязан существовать\n' +
        '(флага --update нет: классификация вносится руками, см. CLAUDE.md).',
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function checkRecorded(rel, entry, problems) {
  const fixtures = Array.isArray(entry.fixtures) ? entry.fixtures : [];
  if (fixtures.length === 0) {
    problems.push(`${rel}: status "recorded", но список fixtures пуст`);
    return;
  }
  for (const fx of fixtures) {
    if (!existsSync(join(FIXTURES_DIR, fx))) {
      problems.push(`${rel}: фикстура test/fixtures/recorded/${fx} не существует`);
    }
  }
  const specPath = entry.spec;
  if (!specPath || !existsSync(join(ROOT, specPath))) {
    problems.push(`${rel}: spec "${specPath ?? ''}" не существует`);
    return;
  }
  const specSrc = readFileSync(join(ROOT, specPath), 'utf8');
  for (const fx of fixtures) {
    if (!specSrc.includes(fx)) {
      problems.push(
        `${rel}: ${specPath} не упоминает фикстуру "${fx}" (имя файла целиком)`,
      );
    }
  }
}

function checkReason(rel, entry, problems) {
  const reason = String(entry.reason ?? '').trim();
  if (reason.length < 20) {
    problems.push(`${rel}: причина короче 20 символов`);
    return;
  }
  const lower = reason.toLowerCase();
  const flag = REASON_RED_FLAGS.find((w) => lower.includes(w));
  if (flag) problems.push(`${rel}: причина похожа на отписку (слово «${flag}»)`);
}

function main() {
  const found = findParsers();
  const baseline = loadBaseline();
  const problems = [];

  if (VERBOSE) {
    console.log(`Найдено ${found.length} кандидатов-парсеров:`);
    for (const { rel, reason } of found) console.log(`  ${rel}  [${reason}]`);
  }

  const foundSet = new Map(found.map((f) => [f.rel, f]));
  const missing = found.filter((f) => !(f.rel in baseline));
  if (missing.length) {
    problems.push(
      'незаклассифицированные парсеры внешнего формата (нет записи в scripts/recorded-fixtures-baseline.json):',
      ...missing.map((f) => `   ${f.rel}`),
    );
  }

  const stale = Object.keys(baseline).filter((rel) => !foundSet.has(rel));
  if (stale.length) {
    problems.push(
      'протухшие записи бейслайна (файл-парсер исчез, или спек больше не читает фикстуру — сверься):',
      ...stale.map((rel) => `   ${rel}`),
    );
  }

  for (const [rel, entry] of Object.entries(baseline)) {
    if (!foundSet.has(rel)) continue; // уже в stale выше
    if (entry.status === 'recorded') {
      checkRecorded(rel, entry, problems);
    } else if (entry.status === 'exempt') {
      checkReason(rel, entry, problems);
    } else {
      problems.push(`${rel}: неизвестный status «${entry.status}» (допустимо recorded|exempt)`);
    }
  }

  if (problems.length) {
    console.error('❌ Гейт «фикстура как у настоящей площадки» (CLAUDE.md, правило №14):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nПарсер внешнего формата обязан быть заведён в\n' +
        'scripts/recorded-fixtures-baseline.json:\n' +
        '  "<файл>": { "status": "recorded", "fixtures": ["<имя в test/fixtures/recorded/>"], "spec": "<файл спека>" }\n' +
        'либо честно:\n' +
        '  "<файл>": { "status": "exempt", "reason": "почему записи нет — не отписка, не короче 20 символов" }\n' +
        'См. test/fixtures/recorded/README.md. Флага --update нет.',
    );
    process.exit(1);
  }

  console.log(
    `✓ гейт recorded-fixtures: ${found.length} парсеров внешнего формата, все классифицированы.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
