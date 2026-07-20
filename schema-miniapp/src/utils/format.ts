// Реэкспорт из shared (правило №3, волна 2) — единственная копия там.
export * from '../../../shared/src/utils/format';

// Было продублировано в LetterEx.tsx и BeliefCheckEx.tsx (webapp), вынесено
// сюда (правило №11); файл парный webapp ↔ miniapp — копии идентичны.
export function fmtAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
