// Стрелки навигации рисунком, а не глифом в тексте (docs/design/APP_2026-11.md, принцип 7): «Назад»,
// «На главную» и «→» в шагах. Рисунок — общий дом глифов ExGlyphs; здесь — обёртка со стилем места.
import type { ReactNode } from 'react';
import { GlyphArrowLeft, GlyphArrowRight } from './exercises/ExGlyphs';

/** Подпись ссылки «назад» со стрелкой слева. Доступное имя — только слова. */
export function BackLabel({ children }: { children: ReactNode }) {
  return <><span className="nav-glyph" aria-hidden="true"><GlyphArrowLeft /></span>{children}</>;
}

/** Строка шага с «→» между пунктами меню («меню → «Сохранить…» → …»): стрелка рисунком, для чтения с
 *  экрана — та же «→» (role=img), текст данных не меняется. */
export function StepText({ text, fmt = (p) => p }: { text: string; fmt?: (part: string) => string }) {
  const parts = text.split(' → ').map(fmt);
  return <>{parts.flatMap((p, i) => i === 0 ? [p] : [
    <span key={i} className="nav-glyph nav-glyph--step" role="img" aria-label="→"><GlyphArrowRight /></span>, p,
  ])}</>;
}
