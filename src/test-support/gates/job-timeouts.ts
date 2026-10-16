// Правила гейта «у каждой джобы CI есть timeout-minutes» (аудит 2026-10,
// правило №24). Без потолка зависший шаг держит джобу до дефолта GitHub в
// 360 минут, и PR полдня висит ни красным, ни зелёным. Чистая функция над
// текстом воркфлоу; разбор джоб — общий с гейтом деплоя (deploy-needs-ci.ts).
// Прогон по настоящим файлам и контрольные образцы — job-timeouts.spec.ts.
import { jobBlocks } from './deploy-needs-ci';

/** GitHub снимает джобу сам на 360-й минуте: потолок не меньше — не потолок. */
export const MAX_JOB_TIMEOUT = 360;

/**
 * Нарушения одного воркфлоу: джоба без `timeout-minutes` на своём уровне
 * (отступ четыре, не шаговый восемь), с нулём или не меньше дефолта GitHub.
 * Джоба, вызывающая переиспользуемый воркфлоу (`uses:` на уровне джобы),
 * таймаута иметь не может, её вызываемый файл проверяется отдельно.
 */
export function jobTimeoutViolations(text: string): string[] {
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(text))) {
    if (/^ {4}uses:/m.test(block)) continue;
    // Значение берётся целиком (`${{ vars.X }}` содержит пробелы): выражение —
    // это «вне 1…359» с исходным текстом, а не «таймаута нет».
    const m = /^ {4}timeout-minutes:[ \t]*(.*?)(?:[ \t]+#.*)?[ \t]*$/m.exec(
      block,
    );
    if (!m) {
      bad.push(`${id}: нет timeout-minutes на уровне джобы`);
      continue;
    }
    const minutes = Number(m[1]);
    if (
      !Number.isInteger(minutes) ||
      minutes <= 0 ||
      minutes >= MAX_JOB_TIMEOUT
    ) {
      bad.push(`${id}: timeout-minutes: ${m[1]} вне 1…${MAX_JOB_TIMEOUT - 1}`);
    }
  }
  return bad;
}
