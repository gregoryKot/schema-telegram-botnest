// Чистые утилиты навигации/истории AppShell — вынесены из AppShell.tsx
// (правило №10). sectionFromPath — своя (по разделам конкретно этого
// фронтенда); fillHistoryGaps — ре-экспорт единственной реализации из
// shared (правило №3, jscpd-свип 2026-08: копия здесь и в удалённом
// мини-аппе была найдена храповиком дублей).
export { fillHistoryGaps } from '../../../../shared/src/utils/todayConstants';

export type Section = 'today' | 'diary' | 'more' | 'schemas' | 'profile' | 'practice';

export function sectionFromPath(path: string): Section {
  const seg = path.split('/').filter(Boolean)[0] ?? 'today';
  if (['today','diary','more','schemas','profile','practice'].includes(seg)) return seg as Section;
  // Legacy redirects
  if (seg === 'help' || seg === 'exercises') return 'practice';
  return 'today';
}
