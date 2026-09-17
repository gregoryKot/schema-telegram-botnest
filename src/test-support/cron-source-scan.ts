// Общий сканер исходников для leader-кронов: находит пары `@Cron(<выражение
// или константа>)` + `claimRun('имя', LEASE_WINDOW.<x>)` внутри тела одного
// метода. Перенесён как есть из cron-leader-windows.spec.ts (логика разбора
// не менялась) в общее место, чтобы у него было два потребителя без второй
// копии парсера (jscpd, правило №11 CLAUDE.md):
// - src/infra/cron-leader-windows.spec.ts — сверяет «окно < период»;
// - src/infra/self-check/cron-lease-registry.spec.ts — сверяет реестр с
//   исходниками (и окно, и саму cron-строку).
// Период/окно из windowKey — дело каждого потребителя (cronPeriodMs /
// LEASE_WINDOW у себя), этот модуль отдаёт только сырое совпадение.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

// Комментарии — не код: упоминание @Cron(/claimRun( в комментарии не должно
// ни рождать находку, ни маскировать настоящую (тот же принцип, что у
// check-cron-leader.mjs).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
}

function skipString(src: string, i: number): number {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i;
    i += 1;
  }
  return i;
}

// matchParen/matchBrace — один и тот же счётчик глубины на разных символах
// скобок (ниже — тонкие обёртки), а не две копии цикла.
function matchDelims(
  src: string,
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchParen(src: string, openIndex: number): number {
  return matchDelims(src, openIndex, '(', ')');
}

function matchBrace(src: string, openIndex: number): number {
  return matchDelims(src, openIndex, '{', '}');
}

/** Имя метода — первая сигнатура после позиции pos (пропускает пробелы,
 * соседние декораторы, модификаторы async/private/…). Тот же алгоритм, что
 * в check-cron-leader.mjs — так метод под `@Cron(` находится идентично тому,
 * что видит production-гейт, а не по своему отдельному, потенциально
 * расходящемуся правилу. */
function findMethodAfter(
  src: string,
  pos: number,
): { name: string; parenOpen: number } | null {
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

/** Константы верхнего уровня файла (например MORNING_CRON = строка
 * расписания) — расписание нередко вынесено в именованную константу
 * (правило CLAUDE.md «константы в начале файла»), а не инлайнится в
 * @Cron(...) напрямую. */
function fileStringConsts(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(['"])((?:\\.|(?!\2).)*)\2\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) map.set(m[1], m[3]);
  return map;
}

/** Первый аргумент вызова, начинающегося с `(` на openIndex: либо строковый
 * литерал (тогда возвращается как есть), либо идентификатор (резолвится по
 * консту того же файла — `@Cron(MORNING_CRON, {...})`). */
function firstCronArg(
  src: string,
  openIndex: number,
  consts: Map<string, string>,
): string | null {
  let i = openIndex + 1;
  while (/\s/.test(src[i])) i += 1;
  if (src[i] === "'" || src[i] === '"') {
    const close = skipString(src, i);
    return src.slice(i + 1, close);
  }
  const m = src.slice(i).match(/^[A-Za-z_$][\w$]*/);
  if (!m) return null;
  return consts.get(m[0]) ?? null;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test-support')
        continue;
      walk(rel, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

const CLAIM_RE =
  /claimRun\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*LEASE_WINDOW\.(\w+)/;

export interface CronClaimFinding {
  file: string;
  method: string;
  cron: string;
  claimName: string;
  windowKey: string;
}

/** Каждая пара `@Cron(...)` + `claimRun('имя', LEASE_WINDOW.<x>)` в теле
 * одного метода, во всём `src/**`. */
export function scanCronClaims(): CronClaimFinding[] {
  const out: CronClaimFinding[] = [];
  for (const rel of walk('src')) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('@Cron(')) continue;
    const src = stripComments(raw);
    const consts = fileStringConsts(src);
    const re = /@Cron\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const decoratorOpen = m.index + m[0].length - 1;
      const decoratorClose = matchParen(src, decoratorOpen);
      if (decoratorClose === -1) continue;
      const cronExpr = firstCronArg(src, decoratorOpen, consts);
      const method = findMethodAfter(src, decoratorClose + 1);
      if (!method || cronExpr === null) continue;
      const paramsClose = matchParen(src, method.parenOpen);
      if (paramsClose === -1) continue;
      const bodyOpen = src.indexOf('{', paramsClose + 1);
      if (bodyOpen === -1) continue;
      const bodyClose = matchBrace(src, bodyOpen);
      if (bodyClose === -1) continue;
      const body = src.slice(bodyOpen, bodyClose + 1);
      const claim = body.match(CLAIM_RE);
      if (!claim) continue; // не заявлен как leader-крон с этим окном — не наша забота здесь
      const [, , claimName, windowKey] = claim;
      out.push({
        file: rel,
        method: method.name,
        cron: cronExpr,
        claimName,
        windowKey,
      });
    }
  }
  return out;
}
