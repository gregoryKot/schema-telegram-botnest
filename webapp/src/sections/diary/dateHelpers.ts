// Хелперы дат таймлайна дневника. Вынесено из DiarySection.tsx (правило №10).

export const TODAY = new Date().toISOString().split('T')[0];
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDateKey(iso: string) {
  return iso.slice(0, 10);
}
export function fmtDayMonth(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${day} ${months[d.getMonth()]}`;
}
export function fmtWeekday(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][d.getDay()];
}
export function dateRelLabel(dateStr: string) {
  const today = new Date(TODAY + 'T12:00:00');
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return null;
}
