// CTA «Записаться» и подсказка над трекером в HistoryView — единственная
// копия (правило №3 CLAUDE.md, Ж9 аудита 2026-08). webapp и miniapp
// разошлись текстом одного и того же действия/подсказки: сведено к более
// информативному варианту (miniapp).
export const BOOKING_CTA_LABEL = 'Записаться и взять сводку →';

export function trackerTapHint(tr: (ty: string, vy: string) => string): string {
  return tr(
    'Нажми на потребность — узнаешь что делать',
    'Нажмите на потребность — узнаете что делать',
  );
}
