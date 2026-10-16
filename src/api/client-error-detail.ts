import type { ClientErrorDto } from './dto/client-error.dto';
import { stripUrlSecrets, stripUrlSecretsInText } from './telemetry-url.util';

/**
 * Подробности отчёта для stdout (второй аргумент `.error()`, в DM не уходят).
 * M8 (аудит 2026-10): url чистился, а message/stack — нет, хотя в стек попадает
 * location.href с живой подписью initData/JWT во фрагменте.
 * `repeats` — сколько отчётов с этого устройства проглочено за прошлое окно.
 */
export function buildClientErrorDetail(
  body: ClientErrorDto,
  repeats: number,
): string {
  const safeUrl = stripUrlSecrets(body.url);
  return [
    stripUrlSecretsInText(`${body.section}: ${body.message}`),
    safeUrl ? `url=${safeUrl}` : null,
    stripUrlSecretsInText(body.stack ?? body.componentStack ?? undefined) ??
      null,
    repeats > 0
      ? `повторов с этого устройства за прошлое окно: ${repeats}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}
