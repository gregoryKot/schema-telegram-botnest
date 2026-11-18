// Блок «Поиск» для /stats (правило №8): чистый форматтер, покрыт тестом с пустой БД; язык простой.
export interface SearchMetrics {
  clients30: number; // за месяц из общего поиска открыли карточек клиентов
  tabs30: number; // вкладок карточки клиента
  sections30: number; // разделов
  guide30: number; // листов справочника
  tasks30: number; // заданий из справочника (дальше выбирают, кому дать)
  actions30: number; // действий
  typed30: number; // из них — после того, как набрали запрос (остальное выбрано из списка без набора)
  recent30: number; // из них — из списка недавно открытого
}

export function formatSearchMetrics(m: SearchMetrics): string {
  const lines = ['🔎 <b>Поиск</b> (за месяц)'];
  const kinds = [m.clients30, m.tabs30, m.sections30, m.guide30, m.tasks30];
  const total = kinds.reduce((sum, n) => sum + n, m.actions30);
  if (total === 0) return `${lines[0]}\nЧерез поиск пока ничего не открывали.`;
  const parts = [
    m.clients30 > 0 && `клиентов — ${m.clients30}`,
    m.tabs30 > 0 && `вкладок клиента — ${m.tabs30}`,
    m.sections30 > 0 && `разделов — ${m.sections30}`,
    m.guide30 > 0 && `листов справочника — ${m.guide30}`,
    m.tasks30 > 0 && `заданий из справочника — ${m.tasks30}`,
    m.actions30 > 0 && `действий — ${m.actions30}`,
  ].filter(Boolean);
  lines.push(`Открыли результатов: ${total} (${parts.join(', ')})`);
  if (m.typed30 > 0) lines.push(`Из них набрав запрос: ${m.typed30}`);
  if (m.recent30 > 0) lines.push(`Из них из недавнего: ${m.recent30}`);
  return lines.join('\n');
}
