// Правила гейта «у каждого lock-файла есть шаг npm audit в CI» (аудит
// 2026-10). До него audit стоял один, на корень: уязвимость в зависимостях
// webapp (код в браузере), мини-аппа, shared и игры видел только аудитор
// глазами. Чистые функции над текстом ci.yml; разбор джоб — workflow-yaml.ts,
// каталог lock-файла — dependabot-coverage.ts. Образцы на оба исхода и прогон
// по настоящим файлам — lockfile-audit.spec.ts.
//
// Шаг может звать npm напрямую или через обёртку с повторами
// `node scripts/npm-audit.mjs <каталог>` (регресс #814: голый audit висел на
// реестре). У обёртки флаги внутри — их и уровень пинит исполнением
// npm-audit.spec.ts, здесь проверяется только форма шага.
//
// Чего гейт НЕ видит: исполнение. Он проверяет наличие и форму шага; ответ
// реестра npm приходит только в CI.
import { lockDirectory, type Coverage } from './dependabot-coverage';
import { jobBlocks } from './workflow-yaml';

/** Уровни, на которых high/critical валят шаг. critical и none — слабее. */
const GATING_LEVELS = new Set(['info', 'low', 'moderate', 'high']);

/**
 * Вызов обёртки; каталог — первый аргумент, без него корень (как у npm).
 * После `.mjs` — пробел или конец: `npm-audit.mjs.bak` — другой файл.
 */
const WRAPPER =
  /\bnode scripts\/npm-audit\.mjs(?=\s|$)(?:[ \t]+["']?([^\s"'|;&]+))?/;

/** Команда audit в начале сегмента shell-строки; `npm audit fix` — не она. */
const CALL = /^(?:node scripts\/npm-audit\.mjs(?=\s|$)|npm audit\b(?! fix))/;

/** Операторы shell, разделяющие команды в строке. */
const OPERATOR = /(\|\||&&|[|;&])/;

/** Вызов audit в строке run и законен ли он как гейт. */
interface AuditCall {
  /** Сама команда с аргументами. */
  call: string;
  /**
   * Исход вызова — исход строки: перед ним ничего или `&&`/`;`, после —
   * ни одного оператора. `x || npm audit` может не исполниться,
   * `npm audit || [ $? -eq 2 ]`, `|| exit 0`, `; exit 0`, `| tee`, `&` —
   * глушат или прячут код выхода.
   */
  sole: boolean;
}

/**
 * Вызовы audit в тексте шага/воркфлоу: команда в начале сегмента строки, не
 * аргумент `echo` и не комментарий. Ключи YAML (`run:`, `- run:`) снимаются.
 */
export function auditCalls(text: string): AuditCall[] {
  const found: AuditCall[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^-?\s*run:\s*/, '');
    if (line.startsWith('#')) continue;
    const parts = line.split(OPERATOR);
    for (let i = 0; i < parts.length; i += 2) {
      const call = parts[i].trim();
      if (!CALL.test(call)) continue;
      const before = i === 0 ? '' : parts[i - 1];
      const last = i === parts.length - 1;
      found.push({ call, sole: last && ['', '&&', ';'].includes(before) });
    }
  }
  return found;
}

/**
 * `--prefix webapp` и `npm-audit.mjs webapp` → `/webapp`; без prefix или
 * аргумента обёртки и `.` → `/`.
 */
export function prefixDirectory(cmd: string): string {
  const m = WRAPPER.exec(cmd) ?? /--prefix[ =]["']?([^\s"']+)/.exec(cmd);
  const dir = (m?.[1] ?? '.').replace(/^\.\/?/, '').replace(/\/+$/, '');
  return dir ? `/${dir}` : '/';
}

/**
 * Команда audit, которой шаг гейтит, или null. Засчитывается обёртка или
 * `npm audit` (не `fix`), уровень не слабее high (без флага npm валит на
 * любой находке — это строже), исход вызова — исход строки (`sole`), и
 * ничто не глушит шаг: ни `continue-on-error: true`, ни `if:` шага. Один
 * заглушенный вызов в шаге — весь шаг не в счёт. Имя шага, `echo` и
 * комментарий не в счёт: «name: npm audit» при `run: echo` — не проверка.
 */
export function gatingAuditCall(step: string): string | null {
  const calls = auditCalls(step.replace(/^\s*name:.*$/gm, ''));
  if (calls.length === 0 || calls.some((c) => !c.sole)) return null;
  for (const { call } of calls) {
    const level = /--audit-level[ =]["']?(\w+)/.exec(call)?.[1];
    if (level !== undefined && !GATING_LEVELS.has(level)) return null;
  }
  if (/^\s*continue-on-error:\s*true\b/m.test(step)) return null;
  if (/^(?: {8})?if:/m.test(step)) return null;
  return calls[0].call;
}

export const isGatingAudit = (step: string): boolean =>
  gatingAuditCall(step) !== null;

/** Шаги джобы: каждый начинается с `      - ` (отступ 6). */
const steps = (job: string): string[] => job.split(/^ {6}- /m).slice(1);

/** Каталоги, которые закрывают засчитанные audit-шаги всех джоб. */
export function auditedDirectories(ciText: string): string[] {
  const dirs = new Set<string>();
  for (const job of Object.values(jobBlocks(ciText))) {
    // Условная или неглушащаяся на уровне джобы — то же, что у шага.
    const header = job.split(/^ {4}steps:/m)[0];
    if (/^ {4}(?:if:|continue-on-error:\s*true\b)/m.test(header)) continue;
    for (const step of steps(job)) {
      const call = gatingAuditCall(step);
      if (call !== null) dirs.add(prefixDirectory(call));
    }
  }
  return [...dirs].sort();
}

/** Каталоги lock-файлов против каталогов audit-шагов. */
export function auditCoverage(ciText: string, lockPaths: string[]): Coverage {
  const wanted = new Set(lockPaths.map(lockDirectory));
  const have = new Set(auditedDirectories(ciText));
  return {
    missing: [...wanted].filter((d) => !have.has(d)).sort(),
    stale: [...have].filter((d) => !wanted.has(d)).sort(),
  };
}

/**
 * Вызовы `npm audit` голым, мимо обёртки, в ci.yml/nightly.yml: без внешнего
 * таймера и повторов он висит на реестре до таймаута шага. Ищутся команды
 * (`echo x && npm audit` — тоже), а не слова: имена шагов, аргументы `echo`
 * и комментарии не в счёт.
 */
export function rawAuditLines(workflowText: string): string[] {
  return auditCalls(workflowText)
    .map((c) => c.call)
    .filter((c) => c.startsWith('npm audit'));
}
