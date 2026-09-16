// Загрузочная проверка env (щит, инциденты 2026-09-15/16). Вызывается ИЗ
// main.ts рядом с logCapabilityReport (capability-boot-log.ts) — тот отчёт
// про «фича выключена», этот — про «переменная задана, но неверна» (чужой
// хост, опечатка, пустая ADMIN_EMAIL при заданном RESEND_API_KEY).
//
// В проде — ОДНО сообщение уровня error со всем списком разом (не по одному
// на переменную): AlertLogger троттлит по нормализованному ключу первых 100
// символов текста, и десять отдельных .error() легко разъехались бы на
// десять разных ключей и десять DM админу за один старт. Не в проде — warn,
// приложение не падает (падение — крашлуп, хуже деградации), кроме уже
// существующих исключений (ENCRYPTION_KEY/DATABASE_URL — падают раньше, в
// своих модулях, см. src/utils/crypto.ts).
import type { Logger } from '@nestjs/common';
import { EnvCheckResult } from './env-check';

type LoggerLike = Pick<Logger, 'log' | 'warn' | 'error'>;

/** Человеческий текст отчёта — переиспользуется логом старта и /stats. */
export function formatEnvCheckLines(result: EnvCheckResult): string[] {
  const lines: string[] = [];
  if (result.missing.length > 0) {
    lines.push(`не задано: ${result.missing.join(', ')}`);
  }
  for (const { name, problem } of result.invalid) {
    lines.push(`неверный формат ${name}: ${problem}`);
  }
  for (const { problem } of result.crossCheckIssues) {
    lines.push(problem);
  }
  return lines;
}

export function logEnvCheck(
  logger: LoggerLike,
  result: EnvCheckResult,
  mode: string = process.env.NODE_ENV ?? 'development',
): void {
  const lines = formatEnvCheckLines(result);
  if (lines.length === 0) {
    logger.log('Реестр env-переменных: всё задано и в порядке.');
    return;
  }

  const message = `Реестр env-переменных — есть замечания:\n${lines
    .map((l) => `  • ${l}`)
    .join('\n')}`;

  if (mode === 'production') logger.error(message);
  else logger.warn(message);
}
