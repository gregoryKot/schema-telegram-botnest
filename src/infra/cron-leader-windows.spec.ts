// Механизм (не таблица руками): окно аренды `LEASE_WINDOW.<x>`, переданное в
// `claimRun(имя, LEASE_WINDOW.<x>)` внутри тела кронового метода, обязано
// быть строго МЕНЬШЕ периода самого `@Cron(...)` — иначе законный тик
// пропускался бы навсегда (аренда предыдущего прогона ещё не истекла бы к
// моменту, когда крону пора сработать снова).
//
// Спек не хранит список кронов руками (это был бы храповик, слепой к новому
// крону, пока его не впишут — тот же изъян, что у `USER_DATA_TABLES` до
// табличного реестра-сверки). Вместо этого он читает исходники `src/**/*.ts`,
// находит пары `@Cron(<выражение>)` + `claimRun('имя', LEASE_WINDOW.<x>)` в
// теле того же метода, сам вычисляет период из cron-выражения и сверяет
// `окно < период`. Константы окон берутся импортом из cron-leader.service.ts,
// а не копией чисел.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { LEASE_WINDOW } from './cron-leader.service';

const ROOT = resolve(__dirname, '..', '..');

// ── Тот же принцип, что у check-cron-leader.mjs: комментарии — не код,
// упоминание @Cron(/claimRun( в комментарии не должно ни рождать, ни маскировать находку.
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

function matchParen(src: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchBrace(src: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
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

/** Период между двумя тиками для поддержанных форм cron-выражения: minute —
 * "каждые N минут" или фиксированная минута; hour — любой час или конкретный
 * (см. examples в тестах ниже: five-minutes-in-two-hours, every-15-minutes,
 * once-an-hour, once-a-day). Форма шире этого списка — осознанно
 * неподдержана (падение говорит явно, что спек не умеет посчитать период,
 * а не молча считает окно валидным). */
function cronPeriodMs(expr: string): number {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron-leader-windows: не 5 полей в выражении «${expr}»`);
  }
  const [minute, hour] = parts;
  const everyN = minute.match(/^\*\/(\d+)$/);
  if (everyN) return Number(everyN[1]) * 60_000;
  if (minute === '*') return 60_000; // */1 по сути — раз в минуту
  if (/^\d+$/.test(minute)) {
    return hour === '*' ? 3_600_000 : 24 * 3_600_000;
  }
  throw new Error(
    `cron-leader-windows: неподдержанная форма minute-поля «${minute}» (выражение «${expr}»)`,
  );
}

interface Finding {
  file: string;
  method: string;
  cronExpr: string;
  periodMs: number;
  leaseName: string;
  windowKey: string;
  windowMs: number;
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

function findAll(): Finding[] {
  const out: Finding[] = [];
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
      const [, , leaseName, windowKey] = claim;
      const windowMs = (LEASE_WINDOW as Record<string, number>)[windowKey];
      out.push({
        file: rel,
        method: method.name,
        cronExpr,
        periodMs: cronPeriodMs(cronExpr),
        leaseName,
        windowKey,
        windowMs,
      });
    }
  }
  return out;
}

describe('LEASE_WINDOW < период @Cron для каждого leader-крона', () => {
  const found = findAll();

  it('механизм реально что-то нашёл (иначе проверка ниже — пустая и лживо-зелёная)', () => {
    // Не хардкодим список кронов — только нижнюю границу-страховку: если этот
    // спек однажды начнёт находить 0 (регресс парсера), тесты ниже прошли бы
    // тривиально на пустом множестве и никто бы не заметил, что гейт ослеп.
    expect(found.length).toBeGreaterThanOrEqual(9);
  });

  it('окно аренды у каждого найденного крона строго меньше периода тика', () => {
    const bad = found.filter((f) => !(f.windowMs < f.periodMs));
    expect(
      bad.map(
        (f) =>
          `${f.file}::${f.method}: LEASE_WINDOW.${f.windowKey}=${f.windowMs}мс ≥ период(${f.cronExpr})=${f.periodMs}мс`,
      ),
    ).toEqual([]);
  });

  it('имена аренд (claimRun) уникальны — иначе два разных крона делят одну строку CronLease', () => {
    const names = found.map((f) => f.leaseName);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('LEASE_WINDOW.<x> из claimRun реально существует в cron-leader.service.ts', () => {
    const unknown = found.filter((f) => typeof f.windowMs !== 'number');
    expect(
      unknown.map((f) => `${f.file}::${f.method}: LEASE_WINDOW.${f.windowKey}`),
    ).toEqual([]);
  });
});

describe('cronPeriodMs — арифметика периода по форме выражения', () => {
  it.each([
    ['*/5 9,10 * * *', 5 * 60_000],
    ['*/15 * * * *', 15 * 60_000],
    ['*/5 * * * *', 5 * 60_000],
    ['* * * * *', 60_000],
    ['0 0 * * *', 24 * 3_600_000],
    ['17 3 * * *', 24 * 3_600_000],
    ['7 * * * *', 3_600_000],
  ])('%s → %dмс', (expr, expected) => {
    expect(cronPeriodMs(expr)).toBe(expected);
  });

  it('неподдержанная форма minute-поля (список минут через запятую) — явно падает, не молчит', () => {
    expect(() => cronPeriodMs('5,35 * * * *')).toThrow();
  });
});
