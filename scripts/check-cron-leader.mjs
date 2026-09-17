#!/usr/bin/env node
// Гейт leader-election для кронов (`@Cron(`, `@nestjs/schedule`).
//
// Крон без leader-election на втором инстансе (второй под, перекатывающийся
// деплой Amvera) выполняется ДВАЖДЫ на том же тике: два процесса шлют одно и
// то же напоминание/пост дважды. Ни один существующий гейт этого не ловит —
// ни `check-alert-throttle.mjs` (троттлинг канала доставки, не дублей
// выполнения), ни `check-silent-catch.mjs`, ни tsc/eslint.
//
// Гейт СПЕЦИАЛЬНО не ищет признак («есть ли рядом claimRun») — поиск по
// признаку молчит о том, чего не знает (тот же изъян, что у
// `USER_DATA_TABLES`/`table-registry.spec.ts`, слепого к новой модели, пока
// её туда не вписали руками). Вместо этого гейт ТРЕБУЕТ явной классификации
// каждого найденного крона в `scripts/cron-leader-baseline.json` — новый крон
// без записи красит CI, а не молча остаётся «наверное безопасным».
//
// Алгоритм:
//   1. Сканирует src/**/*.ts (без *.spec.ts/*.test.ts/test-support/), ищет
//      декоратор `@Cron(` — многострочный декоратор (`@Cron(X, {\n name:
//      ...\n})`) распознаётся балансом скобок, а не одной строкой.
//   2. Имя метода берётся с ближайшей строки объявления после декоратора —
//      `async foo(` и голое `foo(` оба поддержаны.
//   3. Тело метода находится балансом фигурных скобок (простой, но не
//      наивный сканер — строки/шаблонные литералы/комментарии не считаются
//      источником `{`/`}`), внутри ищется `claimRun(`.
//   4. Каждый найденный крон обязан быть в бейслайне:
//        { "status": "leader" | "exempt", "reason": "..." }
//      leader без `claimRun(` в теле — красное. exempt с причиной короче 20
//      символов или словом-отпиской («legacy», «todo», «потом», «позже») —
//      красное. Любой другой status — красное.
//   5. Протухшая запись (крон из бейслайна исчез из кода) — красное: это не
//      уборка, а сигнал «сверься, что произошло» (правило №16 CLAUDE.md).
//
// Флага --update НЕТ и не будет: это классификация решения человека
// («это дублировать нельзя» vs «это идемпотентно/пер-инстансово»), а не
// счётчик долга — переигрывать её автоматически нельзя.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'cron-leader-baseline.json');

// Слова-отписки, недопустимые в exempt-причине (правило №15 CLAUDE.md:
// исключение без разбора — то же самое замалчивание, что и обход гейта).
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

function stripComments(src) {
  // Та же идиома, что в check-silent-catch.mjs: заменяем содержимое
  // комментариев пробелами, сохраняя переводы строк — индексы совпадений
  // остаются верными номерам строк, а сам гейт не путает упоминание
  // `@Cron(`/`claimRun(` в комментарии с настоящим кодом.
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Индекс символа, идущего после строкового/шаблонного литерала, начинающегося в i. */
function skipString(src, i) {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i += 1;
  }
  return i;
}

/** Индекс закрывающей `)`, парной открывающей на openIndex (src[openIndex] === '('). */
function matchParen(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Индекс закрывающей `}`, парной открывающей на openIndex (src[openIndex] === '{'). */
function matchBrace(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Имя метода и позиция его `(` — первая сигнатура после позиции pos,
 * пропуская пробелы, соседние декораторы и модификаторы (async/public/…). */
function findMethodAfter(src, pos) {
  let i = pos;
  const n = src.length;
  for (;;) {
    while (i < n && /\s/.test(src[i])) i += 1;
    if (src[i] !== '@') break;
    i += 1;
    while (i < n && /[\w$.]/.test(src[i])) i += 1;
    while (i < n && /\s/.test(src[i])) i += 1;
    if (src[i] === '(') {
      const close = matchParen(src, i);
      if (close === -1) return null;
      i = close + 1;
    }
  }
  const modRe = /^(?:public|private|protected|static|readonly|async)\s+/;
  for (;;) {
    const m = src.slice(i).match(modRe);
    if (!m) break;
    i += m[0].length;
  }
  const nameMatch = src.slice(i).match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (!nameMatch) return null;
  return { name: nameMatch[1], parenOpen: i + nameMatch[0].length - 1 };
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
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

/** Находит все `@Cron(` в файле и возвращает [{ key, hasClaimRun, line }]. */
function findCrons(relPath, rawSrc) {
  const src = stripComments(rawSrc);
  const found = [];
  const re = /@Cron\(/g;
  let m;
  while ((m = re.exec(src))) {
    const decoratorOpen = m.index + m[0].length - 1;
    const decoratorClose = matchParen(src, decoratorOpen);
    if (decoratorClose === -1) continue;
    const method = findMethodAfter(src, decoratorClose + 1);
    if (!method) continue;
    const paramsClose = matchParen(src, method.parenOpen);
    if (paramsClose === -1) continue;
    const bodyOpen = src.indexOf('{', paramsClose + 1);
    if (bodyOpen === -1) continue;
    const bodyClose = matchBrace(src, bodyOpen);
    if (bodyClose === -1) continue;
    const body = src.slice(bodyOpen, bodyClose + 1);
    found.push({
      key: `${relPath}::${method.name}`,
      hasClaimRun: /claimRun\(/.test(body),
      line: lineAt(src, m.index),
    });
  }
  return found;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — scripts/cron-leader-baseline.json обязан существовать\n' +
        '(флага --update нет: классификация вносится руками, см. CLAUDE.md).',
    );
    process.exit(1);
    return {};
  }
}

function main() {
  const found = new Map();
  for (const rel of walk('src')) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('@Cron(')) continue;
    for (const c of findCrons(rel, raw)) found.set(c.key, c);
  }

  const baseline = loadBaseline();
  const problems = [];

  const missing = [...found.keys()].filter((k) => !(k in baseline));
  if (missing.length) {
    problems.push(
      'незаклассифицированные кроны (нет записи в scripts/cron-leader-baseline.json):',
      ...missing.map((k) => `   ${k}  (L${found.get(k).line})`),
    );
  }

  const stale = Object.keys(baseline).filter((k) => !found.has(k));
  if (stale.length) {
    problems.push(
      'протухшие записи бейслайна (крон в коде не найден — сверься, что произошло):',
      ...stale.map((k) => `   ${k}`),
    );
  }

  for (const [key, entry] of Object.entries(baseline)) {
    if (!found.has(key)) continue; // уже в stale выше
    const status = entry?.status;
    if (status === 'leader') {
      if (!found.get(key).hasClaimRun) {
        problems.push(
          `${key}: объявлен leader, но claimRun( в теле метода не найдено`,
        );
      }
    } else if (status === 'exempt') {
      const reason = String(entry?.reason ?? '').trim();
      if (reason.length < 20) {
        problems.push(`${key}: exempt без внятной причины (короче 20 символов)`);
      } else {
        const lower = reason.toLowerCase();
        const flag = REASON_RED_FLAGS.find((w) => lower.includes(w));
        if (flag) {
          problems.push(`${key}: exempt-причина похожа на отписку (слово «${flag}»)`);
        }
      }
    } else {
      problems.push(`${key}: неизвестный status «${status}» (допустимо leader|exempt)`);
    }
  }

  if (problems.length) {
    console.error('❌ Гейт leader-election для кронов (CLAUDE.md):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nКрон без leader-election дублируется на втором инстансе (второй под,\n' +
        'перекатывающийся деплой) — два процесса шлют одно и то же сообщение\n' +
        'дважды. Для каждого крона впиши в scripts/cron-leader-baseline.json:\n' +
        '  "<файл>::<метод>": { "status": "leader", "reason": "..." }\n' +
        'и добавь claimRun( в тело метода, ЛИБО, если дублирование безопасно\n' +
        '(идемпотентно, пер-инстансово, сериализовано иначе):\n' +
        '  "<файл>::<метод>": { "status": "exempt", "reason": "честная причина, не отписка" }\n' +
        'Флага --update нет — это классификация решения человека, не счётчик.',
    );
    process.exit(1);
  }

  console.log(
    `✓ гейт leader-election кронов: ${found.size} кронов, все классифицированы.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
