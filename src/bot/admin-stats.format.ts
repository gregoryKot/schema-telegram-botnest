// Чистый форматтер админского отчёта /stats. Вынесено из bot.analytics.service.ts
// (правило №10). Форматтер покрыт тестом на населённом И пустом состоянии
// (правило №8): на чистой БД отчёт не должен показывать NaN/undefined/мусор.

export interface AdminStatsData {
  today: string;
  totalUsers: number;
  newUsers7: number;
  newUsers30: number;
  notifyOff: number;
  blockedUsers: number;
  todayCount: number;
  fillRate: number;
  week7Count: number;
  /** «Активное ядро» (docs/LAUNCH_STRATEGY.md §5): ≥3 разных дня дневника за последние 7. Подмножество week7Count. */
  activeCoreCount: number;
  month30Count: number;
  churnRisk: number;
  ret1: number;
  ret3: number;
  ret7: number;
  ret30: number;
  lowestNeed?: { needId: string; _avg: { value: number | null } };
  bestDow: number;
  activePairs: number;
}

const NEED_LABELS: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
};

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function formatAdminStats(d: AdminStatsData): string {
  const lines = [
    `📊 <b>Что происходит в приложении</b> · ${d.today}`,
    '',
    `👥 <b>Люди</b>`,
    `Всего людей: ${d.totalUsers} (новых за неделю: ${d.newUsers7}, за месяц: ${d.newUsers30})`,
    `Выключили напоминания: ${d.notifyOff} · заблокировали бота: ${d.blockedUsers}`,
    '',
    `📔 <b>Дневник настроения</b>`,
    `Заполнили сегодня: ${d.todayCount} (это ${d.fillRate}% от тех, кто заходил за месяц)`,
    `Заходили за неделю: ${d.week7Count} · за месяц: ${d.month30Count}`,
    `Ведут дневник регулярно (хотя бы 3 дня из последних 7): ${d.activeCoreCount} из ${d.week7Count} заходивших за неделю`,
    `⚠️ Могут уйти (заходили раньше, а всю неделю — ни разу): ${d.churnRisk}`,
    '',
    `📈 <b>Сколько дней люди ведут дневник</b> (за всё время)`,
    `Хотя бы 1 день: ${d.ret1}  ·  3 дня и больше: ${d.ret3}  ·  неделю и больше: ${d.ret7}  ·  месяц и больше: ${d.ret30}`,
    '',
    `🔍 <b>Что заметили за неделю</b>`,
    d.lowestNeed
      ? `Людям больше всего не хватает: ${NEED_LABELS[d.lowestNeed.needId] ?? d.lowestNeed.needId} (в среднем ${d.lowestNeed._avg.value?.toFixed(1)} из 10)`
      : 'Пока мало данных о потребностях',
    `Чаще всего заполняют: ${DOW[d.bestDow]}`,
    '',
    `💑 <b>Пары</b> (кто ведёт дневник вдвоём)`,
    `Сейчас вместе: ${d.activePairs}`,
  ];

  return lines.join('\n');
}
