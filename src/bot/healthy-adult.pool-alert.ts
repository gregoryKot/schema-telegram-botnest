/**
 * Предупреждение об иссякающем пуле канала «Здоровый Взрослый».
 *
 * Пул больше не пополняется сам: фразы заносит владелец пачками (см.
 * HEALTHY_ADULT.md). Значит запас конечен, и когда он кончится, канал начнёт
 * повторяться — молча, без единой ошибки в логах. Поэтому предупреждаем
 * заранее.
 *
 * Пороги проверяются на точное совпадение, а не «меньше чем»: публикация
 * уменьшает остаток ровно на единицу, поэтому каждый порог срабатывает один
 * раз, а не превращается в ежедневный спам. Ноль намеренно не в списке —
 * там уже нечего предупреждать, это видно в /stats и в админке.
 */
import type { HealthyAdultPoolStatus } from './healthy-adult.service';

/** Остаток неповторённых фраз, при котором стоит напомнить (≈ неделя / 3 дня / день). */
export const POOL_ALERT_THRESHOLDS = [14, 6, 2];

/** Текст предупреждения или null, если повода писать нет. */
export function poolAlertText(status: HealthyAdultPoolStatus): string | null {
  if (!POOL_ALERT_THRESHOLDS.includes(status.unused)) return null;
  const tail =
    status.daysLeft <= 1
      ? 'Это меньше чем на день.'
      : `Хватит примерно на ${status.daysLeft} дн.`;
  return (
    `📥 Пул канала «Здоровый Взрослый» подходит к концу.\n\n` +
    `Ещё не звучали: ${status.unused} из ${status.enabled}. ${tail}\n\n` +
    'Попроси Claude Code сгенерировать пачку по брифу из HEALTHY_ADULT.md ' +
    'и вставь списком в админке.'
  );
}

/** Строка про пул для отчёта /stats — простыми словами, без терминов. */
export function formatPoolStatus(status: HealthyAdultPoolStatus): string {
  if (status.enabled === 0) {
    return (
      '📥 <b>Канал «Здоровый Взрослый»</b>\n' +
      'Фраз нет совсем — каналу нечего публиковать.'
    );
  }
  const left =
    status.unused === 0
      ? 'Новых не осталось — канал повторяет уже звучавшие.'
      : `Ещё не звучали: ${status.unused} из ${status.enabled} (хватит примерно на ${status.daysLeft} дн.).`;
  return `📥 <b>Канал «Здоровый Взрослый»</b>\n${left}`;
}
