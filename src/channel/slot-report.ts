/**
 * Отчёт владельцу после планового поста: слать ли его и что в нём написать.
 *
 * Упавшая площадка — новость: о ней владелец узнаёт в каждом слоте, и в том же
 * отчёте перечислены молчащие. Молчащая (нет env) — состояние, а не событие:
 * Pinterest не настроен с июля 2026 (#214), и «дошло не везде» приходило в
 * каждом слоте. Одинаковый DM каждый день перестают читать, а вместе с ним
 * пропускают и настоящий сбой. Молчать о ней совсем тоже нельзя: утро
 * 2026-07-31 выключенная площадка выглядела как «всё хорошо». Поэтому отчёт
 * только о молчащих уходит раз в неделю — в понедельник, в утреннем слоте.
 */
import type { HealthyAdultSlot } from '../bot/healthy-adult.schedule';
import type { DeliveryFailure, SilentTarget } from './channel-target';
import { failedSummary, silentSummary } from './publish-report';

/** День напоминания о молчащих: 1 — понедельник, как у `Date.getUTCDay()`. */
const REMINDER_WEEKDAY = 1;
/** Утренний слот: одного напоминания в понедельник достаточно. */
const REMINDER_SLOT: HealthyAdultSlot = 'morning';
const WEEKLY_NOTE =
  'О молчащих площадках напоминаю раз в неделю, по понедельникам.';

/** Что из рассылки слота касается отчёта. */
export interface SlotDelivery {
  failed: DeliveryFailure[];
  silent: SilentTarget[];
}

/**
 * День недели календарного дня `YYYY-MM-DD` (0 — воскресенье). День — полночь
 * UTC (правило №25): `dateKey` уже посчитан по МСК в `mskParts`, и зона машины
 * сдвигать его не должна.
 */
function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

/**
 * Слать ли отчёт о слоте `slot` дня `dateKey` (МСК, из `mskParts`): упавшие —
 * всегда, только молчащие — в понедельник утром, всё дошло — нет.
 */
export function shouldReportSlot(
  res: SlotDelivery,
  dateKey: string,
  slot: HealthyAdultSlot,
): boolean {
  if (res.failed.length > 0) return true;
  if (res.silent.length === 0) return false;
  return slot === REMINDER_SLOT && weekdayOf(dateKey) === REMINDER_WEEKDAY;
}

/** Текст отчёта: кто не принял пост, кто молчал и что будет дальше. */
export function slotReportText(slotName: string, res: SlotDelivery): string {
  const next =
    res.failed.length > 0 ? 'Пробую дослать в ближайшие минуты.' : WEEKLY_NOTE;
  return (
    `Канал ЗВ (${slotName}): дошло не везде\n` +
    `${failedSummary(res.failed)}${silentSummary(res.silent)}\n${next}`
  );
}
