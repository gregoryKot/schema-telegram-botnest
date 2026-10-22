#!/usr/bin/env node
// Гейт «документы для агентов»: CLAUDE.md, правила `.claude/rules/`, карта кода
// `docs/ARCHITECTURE.md` + `docs/architecture/*.md` и реестр открытого
// `docs/open/` не разъезжаются с репозиторием.
//
// Откуда. CLAUDE.md весил около 99 тысяч знаков и грузился в каждую сессию
// целиком — агент платил токенами за правила про Telegram, пока правил CSS.
// Его сжали до короткого индекса, полные тексты правил переехали в
// `.claude/rules/*.md` (подгружаются сами, когда агент трогает файлы из
// `paths`), а «где что лежит» — в карту. Карта без принуждения гниёт: каталог
// переименовали, гейт добавили, а карта по-прежнему ведёт в пустоту, и агент
// идёт по ней, как по вранью. Правило без механизма не работает (CLAUDE.md,
// правило №1) — это и есть механизм.
//
// Что проверяется (каждое нарушение — строка «файл: что не так, как чинить»):
//   1. CLAUDE.md: не больше 200 строк и 16000 «видимых» знаков. Видимые —
//      без блочных <!-- … -->: Claude Code вырезает их до подстановки.
//   2. `.claude/rules/**/*.md`: frontmatter с непустым `paths:` (правило без
//      него грузится в КАЖДУЮ сессию) и не больше 24000 видимых знаков.
//   3. Относительные markdown-ссылки в CLAUDE.md, `.claude/**/*.md`, карте,
//      `docs/README.md`, `docs/open/*.md`, `docs/agent/*.md` ведут на
//      существующий файл или каталог (код и строки в кавычках не читаются).
//   4. Карта называет каждый каталог верхнего уровня (кроме dot-каталогов,
//      node_modules, dist, coverage, build и того, что целиком в .gitignore)
//      и каждый прямой подкаталог src/, webapp/src/, schema-miniapp/src/,
//      shared/src/ — полным путём `src/bot/`. Подпуть чужого корня не
//      засчитывается: `shared/src/pages/` не закрывает `src/pages/`.
//   5. Карта называет по имени каждый scripts/check-*.mjs и check-*.ts.
//   6. Пути в `обратных кавычках` в CLAUDE.md и карте существуют на диске
//      (глобы, шаблоны и каталоги сборки — dist, build — не читаются).
//   7. Каждый docs/open/*.md есть ссылкой в docs/README.md, а в разделе
//      «Что осталось открытым» самого README нет записей (`**…**`, `- …`):
//      ветка, начатая до разделения реестра, при слиянии вписывает их туда.
//
// «Карта» — это docs/ARCHITECTURE.md (индекс, обязан существовать) и все
// docs/architecture/*.md (файлы по областям; каталога может не быть): упоминание
// в любом из них засчитывается.
//
// Бейслайна и `--update` нет намеренно: это классификация, а не счётчик (как
// check-e2e-in-ci.mjs). Запись «не упомянуто, потому что…» была бы тем самым
// замалчиванием (правило №15): каталог, которого нет в карте, добавляют в
// карту; путь, которого нет на диске, из карты убирают. Только чтение файловой
// системы, без git и без зависимостей; ROOT — от расположения скрипта, чтобы
// песочница тестов (gate-sandbox.ts) гоняла его на фикстурах.
import { existsSync, readdirSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { exists, isDir, listMd, read, subdirs, topLevelDirs } from './agent-docs-fs.mjs';
import {
  MAP_SUBDIR_ROOTS,
  MAX_CLAUDE_LINES,
  MAX_CLAUDE_VISIBLE,
  MAX_RULE_VISIBLE,
  SKIP_CLAUDE,
  SKIP_SUB,
  countLines,
  inlineCodeTokens,
  linkFilePath,
  markdownLinks,
  mentionsDir,
  mentionsFile,
  parseFrontmatter,
  tokenRepoPath,
  visibleText,
} from './agent-docs-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const MAP_FILE = 'docs/ARCHITECTURE.md';
const MAP_DIR = 'docs/architecture';
const MAP_HINT = `${MAP_FILE} или ${MAP_DIR}/<область>.md`;

function checkBudgets(root, out) {
  if (!exists(root, 'CLAUDE.md')) {
    out.push('CLAUDE.md: файла нет — это точка входа для агента, верни его.');
    return;
  }
  const text = read(root, 'CLAUDE.md');
  const lines = countLines(text);
  if (lines > MAX_CLAUDE_LINES) {
    out.push(
      `CLAUDE.md: ${lines} строк при потолке ${MAX_CLAUDE_LINES}. Файл грузится в каждую сессию — ` +
        'вынеси полный текст правила в .claude/rules/<тема>.md, в CLAUDE.md оставь строку со ссылкой.',
    );
  }
  const visible = visibleText(text).length;
  if (visible > MAX_CLAUDE_VISIBLE) {
    out.push(
      `CLAUDE.md: ${visible} видимых знаков при потолке ${MAX_CLAUDE_VISIBLE} (блочные <!-- --> не считаются). ` +
        'Перенеси подробности в .claude/rules/ или docs/.',
    );
  }
}

function checkRuleFiles(root, out) {
  const files = listMd(root, '.claude/rules', true);
  for (const rel of files) {
    const text = read(root, rel);
    const fm = parseFrontmatter(text);
    if (!fm || fm.paths.length === 0) {
      out.push(
        `${rel}: ${fm ? 'в frontmatter пустой или отсутствует `paths:`' : 'нет frontmatter'} — ` +
          'правило без paths грузится в КАЖДУЮ сессию. Начни файл с «---», «paths:», ' +
          'строки «  - "glob/**"» и закрывающего «---».',
      );
    }
    const visible = visibleText(text).length;
    if (visible > MAX_RULE_VISIBLE) {
      out.push(
        `${rel}: ${visible} видимых знаков при потолке ${MAX_RULE_VISIBLE}. Раздели правило по темам: ` +
          'сработав, оно грузится целиком.',
      );
    }
  }
  return files.length;
}

/** Относительные ссылки файлов ведут на существующее; возвращает число проверенных. */
function checkLinks(root, out, files) {
  let total = 0;
  for (const rel of files) {
    for (const { target, line } of markdownLinks(read(root, rel))) {
      const path = linkFilePath(target);
      if (path === null) continue;
      total++;
      if (!existsSync(resolve(root, dirname(rel), path))) {
        out.push(
          `${rel}:${line}: ссылка на ${target} не ведёт никуда (файла или каталога ` +
            `${relative(root, resolve(root, dirname(rel), path))} нет). Поправь путь или убери ссылку.`,
        );
      }
    }
  }
  return total;
}

function checkMapCoverage(root, out, mapText) {
  const wanted = topLevelDirs(root);
  for (const sub of MAP_SUBDIR_ROOTS) {
    wanted.push(...subdirs(root, sub, SKIP_SUB).map((d) => `${sub}/${d}`));
  }
  const missing = wanted.filter((d) => !mentionsDir(mapText, d));
  for (const d of missing) {
    out.push(`${MAP_FILE}: в карте нет каталога ${d}/. Добавь строку в карту: ${MAP_HINT}.`);
  }
  const gates = exists(root, 'scripts') ? readdirSync(join(root, 'scripts')) : [];
  const names = gates.filter((f) => /^check-.+\.(mjs|ts)$/.test(f)).sort();
  for (const g of names.filter((n) => !mentionsFile(mapText, n))) {
    out.push(`scripts/${g}: гейта нет в карте. Добавь строку в карту: ${MAP_HINT}.`);
  }
  return { dirs: wanted.length, gates: names.length };
}

function checkStalePaths(root, out, files) {
  const roots = topLevelDirs(root);
  for (const rel of files) {
    for (const token of new Set(inlineCodeTokens(read(root, rel)))) {
      const path = tokenRepoPath(token, roots);
      if (path === null) continue;
      const abs = join(root, path);
      const ok = path.endsWith('/') ? isDir(abs) : existsSync(abs);
      if (!ok) {
        out.push(
          `${rel}: путь \`${token}\` не существует на диске. Исправь путь, а если файл удалён или ` +
            'переехал — убери упоминание.',
        );
      }
    }
  }
}

function checkOpenIndex(root, out) {
  const open = listMd(root, 'docs/open');
  if (open.length === 0) return 0;
  if (!exists(root, 'docs/README.md')) {
    out.push('docs/README.md: файла нет, а в docs/open/ лежат реестры — им нужен индекс.');
    return open.length;
  }
  const linked = new Set(
    markdownLinks(read(root, 'docs/README.md'))
      .map((l) => linkFilePath(l.target))
      .filter((p) => p !== null)
      .map((p) => relative(root, resolve(root, 'docs', p)).split('\\').join('/')),
  );
  for (const rel of open.filter((f) => !linked.has(f))) {
    out.push(
      `docs/README.md: нет ссылки на ${rel} (open/${rel.split('/').pop()}). ` +
        'Реестр без строки в индексе агент не найдёт — добавь строку в таблицу «Что осталось открытым».',
    );
  }
  for (const line of entriesInOpenIndex(read(root, 'docs/README.md'))) {
    out.push(
      `docs/README.md:${line}: запись реестра в индексе «Что осталось открытым». ` +
        'Перенеси её дословно в docs/open/<область>.md (правило №26); в README — только таблица областей.',
    );
  }
  return open.length;
}

/** Номера строк с записями (`**…**`, `- …`) в разделе «Что осталось открытым» README. */
export function entriesInOpenIndex(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^## Что осталось открытым/.test(l));
  if (start < 0) return [];
  const found = [];
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
    if (/^(\*\*|[-*] )/.test(lines[i])) found.push(i + 1);
  }
  return found;
}

/** Все проверки на дереве `root`: { violations, stats }. */
export function checkAgentDocs(root) {
  const out = [];
  checkBudgets(root, out);
  const rules = checkRuleFiles(root, out);
  const mapFiles = [MAP_FILE, ...listMd(root, MAP_DIR)].filter((f) => exists(root, f));
  const linkFiles = [
    'CLAUDE.md',
    ...listMd(root, '.claude', true, SKIP_CLAUDE),
    ...mapFiles,
    'docs/README.md',
    ...listMd(root, 'docs/open'),
    ...listMd(root, 'docs/agent'),
  ].filter((f) => exists(root, f));
  const links = checkLinks(root, out, [...new Set(linkFiles)]);

  let coverage = { dirs: 0, gates: 0 };
  if (!exists(root, MAP_FILE)) {
    out.push(`${MAP_FILE}: файла нет — карта кода обязана существовать (индекс; области — в ${MAP_DIR}/).`);
  } else {
    const mapText = mapFiles.map((f) => read(root, f)).join('\n');
    coverage = checkMapCoverage(root, out, mapText);
  }
  checkStalePaths(root, out, ['CLAUDE.md', ...mapFiles].filter((f) => exists(root, f)));
  const open = checkOpenIndex(root, out);
  return { violations: out, stats: { rules, links, open, ...coverage } };
}

function main() {
  const { violations, stats } = checkAgentDocs(ROOT);
  if (violations.length) {
    console.error('❌ Гейт «документы для агентов»:\n');
    for (const v of violations) console.error(v);
    console.error(
      '\nCLAUDE.md и правила грузятся в контекст агента, карта ведёт его по коду; ' +
        'вранье в них обходится дороже, чем отсутствие.\n' +
        'Бейслайна и --update нет: исправь документ, а не гейт (правило №15).',
    );
    process.exit(1);
  }
  console.log(
    `✓ документы для агентов: CLAUDE.md в бюджете, правил ${stats.rules} с paths, ` +
      `ссылок ${stats.links}, в карте ${stats.dirs} каталогов и ${stats.gates} гейтов, ` +
      `реестров открытого ${stats.open} в индексе.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
