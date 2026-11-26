// Блок «Запись из приложения» для /stats (правило №8, #546): клиенты, у
// которых владелец практики — терапевт, открывают «Записаться на сессию» в
// «Мой терапевт» и записываются сами, без формы. За 30 дней: сколько раз
// открыли, сколько человек, сколько записей создано и сколько из них ждали
// оплаты. Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.

export interface ClientBookingMetrics {
  /** Сколько раз открыли лист записи. */
  opened: number;
  /** Сколько разных людей открывали. */
  openedPeople: number;
  /** Записи, которые ждали оплаты (рубли, онлайн-оплата). */
  held: number;
  /** Записи, подтверждённые сразу (оплата не в рублях — договариваются сами). */
  confirmed: number;
}

export function formatClientBookingMetrics(m: ClientBookingMetrics): string {
  const title = '🗓 <b>Запись из приложения</b> (за 30 дней)';
  const lines: string[] = [];
  if (m.opened > 0)
    lines.push(`Открыли запись: ${m.opened} раз, людей — ${m.openedPeople}.`);
  const booked = m.held + m.confirmed;
  if (booked > 0) {
    const parts = [
      m.held > 0 ? `ждали оплаты ${m.held}` : null,
      m.confirmed > 0 ? `подтверждены сразу ${m.confirmed}` : null,
    ].filter((s): s is string => s !== null);
    lines.push(`Записались: ${booked} (${parts.join(', ')}).`);
  }
  if (lines.length === 0) lines.push('Пока никто не записывался сам.');
  return [title, ...lines].join('\n');
}
