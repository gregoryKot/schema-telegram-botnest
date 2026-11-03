// Форматирование дат — единственная копия (правило №3 CLAUDE.md, волна 2).
const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];
const MONTHS_LONG = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** «7 апр», «26 мая»; год не текущий у смотрящего — «26 сен 2025» (QA 2026-10-26). */
export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const base = `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]}`;
  return y === todayStr().slice(0, 4) ? base : `${base} ${parseInt(y)}`;
}

/** "7 апреля" from "2026-04-07" — safe, no timezone shift */
export function fmtDateLong(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS_LONG[parseInt(m) - 1]}`;
}

/** YYYY-MM-DD произвольной даты в ЛОКАЛЬНОЙ зоне. Нужен всем, кто считает
 *  «сегодня/вчера» рядом с todayStr(): смешивать его с
 *  `toISOString().split('T')[0]` (UTC) нельзя — в зонах, где локальная дата
 *  уже другая, получаются два разных «сегодня». */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD местного дня человека — единственное «местное сегодня» фронтов (`now` — для тестов). */
export function todayStr(now: Date = new Date()): string {
  return localDateStr(now);
}

/** «сегодня» / «вчера» / «N дн. назад» / «3 авг.» для момента времени.
 *  Разница считается в миллисекундах, поэтому от зоны машины не зависит;
 *  дату старше недели показываем в зоне читателя — момент остаётся моментом
 *  (правило №25 CLAUDE.md). */
export function fmtAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}
