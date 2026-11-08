// Чистые форматтеры разделов «Главных цифр» /stats (правило №10). Раздел —
// свой блок settleBlocks (admin-stats.blocks.ts): упал один запрос — заглушка
// только у его раздела (аудит 2026-10, infra#28). Тест — на населённом И
// пустом состоянии (правило №8): на чистой БД без NaN/undefined/мусора.

export interface PeopleData {
  totalUsers: number;
  newUsers7: number;
  newUsers30: number;
  notifyOff: number;
  blockedUsers: number;
}

export interface DiaryData {
  todayCount: number;
  fillRate: number;
  week7Count: number;
  /** «Активное ядро» (docs/LAUNCH_STRATEGY.md §5): ≥3 разных дня дневника за последние 7. Подмножество week7Count. */
  activeCoreCount: number;
  month30Count: number;
  churnRisk: number;
}

export interface DaysData {
  ret1: number;
  ret3: number;
  ret7: number;
  ret30: number;
}

export interface NoticedData {
  lowestNeed?: { needId: string; _avg: { value: number | null } };
  /** 0 — вс … 6 — сб; null — за месяц не было ни одной записи. */
  bestDow: number | null;
}

const NEED_LABELS: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
};

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const formatStatsHeader = (today: string): string =>
  `📊 <b>Что происходит в приложении</b> · ${today}`;

export const formatPeople = (d: PeopleData): string =>
  [
    `👥 <b>Люди</b>`,
    `Всего людей: ${d.totalUsers} (новых за неделю: ${d.newUsers7}, за месяц: ${d.newUsers30})`,
    // «Бот не может им написать», а не «заблокировали бота»: в это число
    // попадает и тот, у кого чат просто не нашёлся. Формулировка «заблокировали»
    // читалась как выбор человека, хотя часто это была наша ошибка адресации.
    `Выключили напоминания: ${d.notifyOff} · бот не может им написать: ${d.blockedUsers}`,
  ].join('\n');

export const formatDiary = (d: DiaryData): string =>
  [
    `📔 <b>Дневник настроения</b>`,
    `Заполнили сегодня: ${d.todayCount} (это ${d.fillRate}% от тех, кто заходил за месяц)`,
    `Заходили за неделю: ${d.week7Count} · за месяц: ${d.month30Count}`,
    `Ведут дневник регулярно (хотя бы 3 дня из последних 7): ${d.activeCoreCount} из ${d.week7Count} заходивших за неделю`,
    `⚠️ Могут уйти (заходили раньше, а всю неделю — ни разу): ${d.churnRisk}`,
  ].join('\n');

export const formatDays = (d: DaysData): string =>
  [
    `📈 <b>Сколько дней люди ведут дневник</b> (за всё время)`,
    `Хотя бы 1 день: ${d.ret1}  ·  3 дня и больше: ${d.ret3}  ·  неделю и больше: ${d.ret7}  ·  месяц и больше: ${d.ret30}`,
  ].join('\n');

export const formatNoticed = (d: NoticedData): string =>
  [
    `🔍 <b>Что заметили за неделю</b>`,
    d.lowestNeed
      ? `Людям больше всего не хватает: ${NEED_LABELS[d.lowestNeed.needId] ?? d.lowestNeed.needId} (в среднем ${d.lowestNeed._avg.value?.toFixed(1)} из 10)`
      : 'Пока мало данных о потребностях',
    `Чаще всего заполняют: ${d.bestDow === null ? 'пока мало записей, чтобы сказать' : DOW[d.bestDow]}`,
  ].join('\n');

export const formatPairs = (activePairs: number): string =>
  [
    `💑 <b>Пары</b> (кто ведёт дневник вдвоём)`,
    `Сейчас вместе: ${activePairs}`,
  ].join('\n');
