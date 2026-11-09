// Значки-глифы оболочки упражнений и мастеров (стрелки, галочка, плюс, крестик, шеврон, лента-стрелка): SVG в цвет текста.
// Один дом глифов: экраны на ExScreen берут глифы через его реэкспорт, а модули без ExScreen (ExBar,
// быстрая запись, лента: GratitudeParts, DiaryDraft, SchemaChipsStep) — отсюда напрямую, чтобы не тянуть
// ExScreen в свой чанк. ExScreen.tsx держит раскладку экрана.
export function GlyphArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
}
export function GlyphArrowRight() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
export function GlyphCheck() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4.5" /></svg>;
}
export function GlyphPlus() {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>;
}
export function GlyphX() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}
/** Шеврон раскрытия («Показать все / Только мои»): вниз — свернуто, вверх — раскрыто. Размер — у места (CSS). */
export function GlyphChevron({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? 'M2 8 L6 4 L10 8' : 'M2 4 L6 8 L10 4'} />
    </svg>
  );
}
/** Лента-стрелка цепочки режимов (знак режима → знаки групп кандидатов): волной, а не прямой. Размер — у места. */
export function GlyphRibbonArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 C 15 3, 27 17, 47 9" />
      <path d="M41 4 L48 9 L42 15" />
    </svg>
  );
}
