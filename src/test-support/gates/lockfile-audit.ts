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
// npm-audit.spec.ts, здесь проверяется только форма шага: скрипт `run:` (в
// том виде, в каком его получит shell, — step-script.ts) — одна команда,
// и её исход — исход шага.
//
// Чего гейт НЕ видит: исполнение. Он проверяет наличие и форму шага; ответ
// реестра npm приходит только в CI.
import { lockDirectory, type Coverage } from './dependabot-coverage';
import { joinContinuations, runScript } from './step-script';
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
  for (const raw of joinContinuations(text).split('\n')) {
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
 * Что в скрипте отменяет «исход вызова — исход шага»: `exit`/`return` до
 * вызова (`exit 0; npm audit`), `trap … EXIT` переписывает код выхода,
 * `set +e` — выход по ошибке.
 */
const ESCAPE =
  /(?:^|[;&|(]\s*)(?:exit|return|exec|trap)\b|\bset\s[^;&|\n]*(?:\+[a-zA-Z]*e|\+o\s+errexit)/;

/** `continue-on-error` с любым значением, кроме `false`: `${{ true }}` тоже глушит. */
const SOFT_FAIL = /^\s*continue-on-error:(?!\s*false\s*(?:#.*)?$)/m;

/**
 * Команда audit, которой шаг гейтит, или null. Засчитывается обёртка или
 * `npm audit` (не `fix`), уровень не слабее high (без флага npm валит на
 * любой находке — это строже). Скрипт `run:` — ровно одна строка-команда
 * (комментарии не в счёт), вызов — её исход (`sole`): многострочный скрипт
 * глушит код по-разному (`set +e` … `exit 0`, функция или `{ … } || true`,
 * `trap`), и перечислять формы — значит пропустить следующую. Ничто не
 * глушит шаг: ни `continue-on-error`, ни `if:`, ни свой `shell:` (у
 * `bash {0}` нет `-e`). Имя шага, `echo` и комментарий не в счёт: «name:
 * npm audit» при `run: echo` — не проверка.
 */
export function gatingAuditCall(step: string): string | null {
  const script = runScript(step);
  if (script === null) return null;
  const commands = script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (commands.length !== 1 || ESCAPE.test(commands[0])) return null;
  const calls = auditCalls(commands[0]);
  if (calls.length !== 1 || !calls[0].sole) return null;
  const level = /--audit-level[ =]["']?(\w+)/.exec(calls[0].call)?.[1];
  if (level !== undefined && !GATING_LEVELS.has(level)) return null;
  if (SOFT_FAIL.test(step) || /^\s*shell:/m.test(step)) return null;
  if (/^(?: {8})?if:/m.test(step)) return null;
  return calls[0].call;
}

export const isGatingAudit = (step: string): boolean =>
  gatingAuditCall(step) !== null;

/**
 * Шаги джобы: каждый начинается с `      - ` (отступ 6). Отступ первой
 * строки возвращается (ключи шага — на 8), чтобы runScript видел, где
 * кончается значение `run:`.
 */
const steps = (job: string): string[] =>
  job
    .split(/^ {6}- /m)
    .slice(1)
    .map((s) => ' '.repeat(8) + s);

/** Каталоги, которые закрывают засчитанные audit-шаги всех джоб. */
export function auditedDirectories(ciText: string): string[] {
  const dirs = new Set<string>();
  // `defaults: run: shell:` воркфлоу — свой shell у каждого шага.
  if (/^\s+shell:/m.test(ciText.split(/^jobs:/m)[0])) return [];
  for (const job of Object.values(jobBlocks(ciText))) {
    // Условная, неглушащаяся или со своим shell на уровне джобы — то же,
    // что у шага.
    const header = job.split(/^ {4}steps:/m)[0];
    if (/^ {4}if:/m.test(header) || SOFT_FAIL.test(header)) continue;
    if (/^\s+shell:/m.test(header)) continue;
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
