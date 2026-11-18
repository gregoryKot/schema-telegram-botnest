// Блок «Поиск» для /stats (правило №8: событие, которого нет в отчёте, невидимо).
// Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
export interface SearchMetrics {
  clients30: number; // за месяц из общего поиска открыли карточек клиентов
  sections30: number; // разделов
  guide30: number; // листов справочника
  actions30: number; // действий
  typed30: number; // из них — после того, как набрали запрос (остальное выбрано из списка без набора)
  recent30: number; // из них — из списка недавно открытого
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatSearchMetrics(m: SearchMetrics): string {
  const lines = ['🔎 <b>Поиск</b> (за месяц)'];
  const total = m.clients30 + m.sections30 + m.guide30 + m.actions30;
  if (total === 0) {
    lines.push('Через поиск пока ничего не открывали.');
    return lines.join('\n');
  }
  const parts = [
    m.clients30 > 0 && `клиентов — ${m.clients30}`,
    m.sections30 > 0 && `разделов — ${m.sections30}`,
    m.guide30 > 0 && `листов справочника — ${m.guide30}`,
    m.actions30 > 0 && `действий — ${m.actions30}`,
  ].filter(Boolean);
  lines.push(`Открыли результатов: ${total} (${parts.join(', ')})`);
  if (m.typed30 > 0) lines.push(`Из них набрав запрос: ${m.typed30}`);
  if (m.recent30 > 0) lines.push(`Из них из недавнего: ${m.recent30}`);
  return lines.join('\n');
}
