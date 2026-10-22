// Правила гейта «у каждого lock-файла есть шаг npm audit в CI» (аудит
// 2026-10). До него audit стоял один, на корень: уязвимость в зависимостях
// webapp (код в браузере), мини-аппа, shared и игры видел только аудитор
// глазами. Чистые функции над текстом ci.yml; разбор джоб — workflow-yaml.ts,
// каталог lock-файла — dependabot-coverage.ts. Образцы на оба исхода и прогон
// по настоящим файлам — lockfile-audit.spec.ts.
//
// Чего гейт НЕ видит: исполнение. Он проверяет наличие и форму шага; ответ
// реестра npm приходит только в CI.
import { lockDirectory, type Coverage } from './dependabot-coverage';
import { jobBlocks } from './workflow-yaml';

/** Уровни, на которых high/critical валят шаг. critical и none — слабее. */
const GATING_LEVELS = new Set(['info', 'low', 'moderate', 'high']);

/** `--prefix webapp` → `/webapp`, без prefix и `.` → `/`. */
export function prefixDirectory(cmd: string): string {
  const m = /--prefix[ =]["']?([^\s"']+)/.exec(cmd);
  const dir = (m?.[1] ?? '.').replace(/^\.\/?/, '').replace(/\/+$/, '');
  return dir ? `/${dir}` : '/';
}

/**
 * Засчитывается ли шаг как гейт: `npm audit` (не `fix`), уровень не слабее
 * high (без флага npm валит на любой находке — это строже), и ничто не
 * глушит исход: ни `continue-on-error: true`, ни `|| true`, ни `if:` шага.
 */
export function isGatingAudit(step: string): boolean {
  if (!/\bnpm audit\b(?! fix)/.test(step)) return false;
  const level = /--audit-level[ =]["']?(\w+)/.exec(step)?.[1];
  if (level !== undefined && !GATING_LEVELS.has(level)) return false;
  if (/^\s*continue-on-error:\s*true\b/m.test(step)) return false;
  if (/\|\|\s*(?:true\b|:(?!\S))/.test(step)) return false;
  if (/^(?: {8})?if:/m.test(step)) return false;
  return true;
}

/** Шаги джобы: каждый начинается с `      - ` (отступ 6). */
const steps = (job: string): string[] => job.split(/^ {6}- /m).slice(1);

/** Каталоги, которые закрывают засчитанные audit-шаги всех джоб. */
export function auditedDirectories(ciText: string): string[] {
  const dirs = new Set<string>();
  for (const job of Object.values(jobBlocks(ciText))) {
    // Условная или неглушащаяся на уровне джобы — то же, что у шага.
    const header = job.split(/^ {4}steps:/m)[0];
    if (/^ {4}(?:if:|continue-on-error:\s*true\b)/m.test(header)) continue;
    for (const step of steps(job).filter(isGatingAudit)) {
      dirs.add(prefixDirectory(step));
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
