// Подпись клиента без имени в доске заданий терапевта (GET /api/therapy/tasks/all):
// остальной кабинет подписывает клиентов на сайте функцией clientDisplayName
// (shared/src/therapy/clientInitials.ts), а доска получает имя готовым с сервера.
// До 2026-11 здесь стояло «ID 123», на «Сегодня» — «#123»: один клиент, четыре
// формы. Бэкенд shared не импортирует — копия, сверка в
// client-display-name.sync.spec.ts (правило №4).

export const UNNAMED_CLIENT = 'Без имени';

/** «Без имени · 123»; у офлайн-клиента id отрицательный — номер без минуса. */
export function unnamedClientLabel(id: bigint): string {
  return `${UNNAMED_CLIENT} · ${id < 0n ? -id : id}`;
}
