// «Доделать» в списке записей админки (аудит 2026-10). Бронь CONFIRMED, а
// эффекты подтверждения — ссылка на встречу, событие календаря, DM владельцу —
// не доехали (`confirmEffectsDoneAt` пуст: упал Zoom или CalDAV, умер под).
// Кнопка зовёт тот же POST /api/booking/admin/confirm/:id, что «Подтвердить»:
// по CONFIRMED сервер только доводит эффекты (`rerunEffects`,
// src/booking/booking.confirm-effects.ts) — сделанное пропускает, проход моложе
// минуты не трогает, клиенту ничего не шлёт. Штатно то же добирает крон раз в
// 5 минут (booking-confirm-retry.service.ts), и тоже только будущие брони.
//
// Сравнение строгое (`=== null`): поле отдаёт сервер целой строкой брони; если
// его в ответе нет вовсе, кнопка не появляется у каждой подтверждённой записи.

export interface ConfirmFinishInput {
  status: string;
  startsAt: string;
  confirmEffectsDoneAt?: string | null;
}

/** Показывать ли «Доделать»: подтверждена, эффекты не доведены, встреча впереди. */
export function needsConfirmFinish(b: ConfirmFinishInput, now = Date.now()): boolean {
  return b.status === 'CONFIRMED'
    && b.confirmEffectsDoneAt === null
    && new Date(b.startsAt).getTime() > now;
}
