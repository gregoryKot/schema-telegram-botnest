#!/usr/bin/env node
// Гейт «путь в обратных кавычках существует» (аудит 2026-10, «Механизмы»,
// п. 11; битые указатели CLAUDE.md чинил руками #643).
//
// Документы для агентов называют файлы путями в обратных кавычках —
// `src/infra/cron-leader.service.ts`, `scripts/check-dead-files.mjs`, — и по
// ним агент идёт в код. Файл переехал или удалён, а строка осталась: карта
// врёт, и агент тратит шаги на поиск того, чего нет. check-agent-docs.mjs
// сверяет только markdown-ссылки `[…](…)`; пути в кавычках не сверял никто.
//
// Что сверяется: `CLAUDE.md`, `docs/SECURITY.md`, `docs/README.md`,
// `.claude/rules/*.md`. Путём считается span в обратных кавычках без пробелов,
// который начинается с каталога верхнего уровня репозитория (`src/`,
// `webapp/`, …) или называет корневой файл из списка `ROOT_FILES`
// (`package.json`, `Dockerfile`…). Хвосты `:12`, `:12-40`, `#якорь`,
// `::метод` отрезаются. Маски (`*`, `<имя>`, `{a,b}`, `…`) не сверяются — это
// не путь, а шаблон. Путь с `/` на конце — каталог.
//
// Исключение — `scripts/doc-refs-baseline.json`: «файл::путь» → причина
// (путь нарочно несуществующий — пример в правиле, файл удалён и упомянут как
// история). Протухшая запись (путь появился или строка исчезла) — красное.
// Без --update: это решение, а не счётчик.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'doc-refs-baseline.json');
const ROOT_FILES = new Set(['package.json', 'Dockerfile', 'amvera.yml', 'CLAUDE.md', 'HEALTHY_ADULT.md', 'README.md', 'tsconfig.json', 'tsconfig.build.json', '.gitattributes', '.gitignore', '.dockerignore', 'eslint.config.mjs', 'playwright.config.ts', 'nest-cli.json']);

export function docFiles() {
  const files = ['CLAUDE.md', 'docs/SECURITY.md', 'docs/README.md'];
  const rules = join(ROOT, '.claude', 'rules');
  if (existsSync(rules)) {
    for (const n of readdirSync(rules).sort()) if (n.endsWith('.md')) files.push(`.claude/rules/${n}`);
  }
  return files.filter((f) => existsSync(join(ROOT, f)));
}

function topDirs() {
  return new Set(
    readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'node_modules' && d.name !== '.git')
      .map((d) => d.name),
  );
}

/** Пути из текста документа: [{ path, line }]. HTML-комментарии тоже
 * сверяются — их читает владелец, и врать им так же нельзя. */
export function extractPaths(text, dirs) {
  const out = [];
  const lines = text.split('\n');
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    for (const m of l.matchAll(/`([^`\s]+)`/g)) {
      let p = m[1].replace(/(::|#)\S*$/, '').replace(/:\d+(?:-\d+)?$/, '').replace(/[.,;:]$/, '');
      if (/[*<>{}…$]|^\.\.?\//.test(p) || /^[a-z]+:\/\//.test(p)) continue;
      const head = p.split('/')[0];
      const isPath = (p.includes('/') && dirs.has(head)) || ROOT_FILES.has(p);
      if (isPath) out.push({ path: p, line: i + 1 });
    }
  });
  return out;
}

function main() {
  const dirs = topDirs();
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const problems = [];
  const seen = new Set();
  let checked = 0;
  for (const doc of docFiles()) {
    for (const { path, line } of extractPaths(readFileSync(join(ROOT, doc), 'utf8'), dirs)) {
      checked += 1;
      const key = `${doc}::${path}`;
      if (existsSync(join(ROOT, path))) continue;
      seen.add(key);
      if (!(key in baseline)) problems.push(`${doc}:${line}: \`${path}\` — такого пути в репозитории нет`);
    }
  }
  for (const [key, reason] of Object.entries(baseline)) {
    if (!seen.has(key)) problems.push(`бейслайн ${key}: путь существует или строки больше нет — запись протухла`);
    else if (String(reason).trim().length < 20) problems.push(`бейслайн ${key}: причина короче 20 символов`);
  }
  if (problems.length) {
    console.error('❌ Пути в документах для агентов ведут в никуда:\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nИсправь путь (файл переехал — новый путь; удалён — убери упоминание или назови историю\n' +
        'словами). Нарочно несуществующий путь (пример) — scripts/doc-refs-baseline.json с причиной.',
    );
    process.exit(1);
  }
  console.log(`✓ пути в документах: ${checked} упоминаний в ${docFiles().length} файлах, все существуют.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
