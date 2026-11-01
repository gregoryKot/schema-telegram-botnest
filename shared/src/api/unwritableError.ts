// Отказ записи поверх нечитаемых данных: бэкенд отвечает 409 { reason:
// 'unreadable_data' } (`assertWritable` в src/utils/crypto-record.ts), когда
// записанное значение сейчас не расшифровывается (ключ не подошёл) и новая
// запись стёрла бы его навсегда. Клиент получил вместо данных пустой список —
// повтор не поможет, «проверь связь» соврёт. Один хелпер на оба фронтенда
// (правило №3); бэкендовую копию кода сверяет src/bot/user-settings-write.spec.ts.
export const UNWRITABLE_REASON = 'unreadable_data';

export function isUnwritableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; reason?: unknown };
  return e.status === 409 && e.reason === UNWRITABLE_REASON;
}

// Текст для экрана «Мои схемы/режимы»: выбор остался на устройстве
// (localStorage), сервер его не принял. Без рода, в обеих формах.
export function unwritableSelectionText(
  tr: (ty: string, vy: string) => string,
): string {
  return tr(
    'Выбор не сохранился на сервере: прежний список сейчас не читается, и новая запись стёрла бы его. На этом устройстве выбор остался. О сбое уже сообщено — попробуй ещё раз позже',
    'Выбор не сохранился на сервере: прежний список сейчас не читается, и новая запись стёрла бы его. На этом устройстве выбор остался. О сбое уже сообщено — попробуйте ещё раз позже',
  );
}

// Пара форм для SaveErrorNote обоих фронтендов (`<SaveErrorNote {...NOTE} />`).
export const UNWRITABLE_SELECTION_NOTE = {
  ty: unwritableSelectionText((ty) => ty),
  vy: unwritableSelectionText((_ty, vy) => vy),
};
