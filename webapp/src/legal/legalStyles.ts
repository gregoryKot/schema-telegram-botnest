// Стили юридических страниц (`pages/PrivacyPage.tsx`, `pages/OfferPage.tsx`);
// компоненты разметки — `LegalLayout.tsx`. Отдельный файл: модуль компонентов
// экспортирует только компоненты (быстрое обновление Vite).
import type { CSSProperties } from 'react';

// Колонка подписи — 220px на широком экране и не больше 38% строки на узком:
// у всех строк таблицы одна ширина, поэтому колонки остаются ровными.
export const TABLE_ROW_COLUMNS = 'min(220px, 38%) minmax(0, 1fr)';

// Поля страницы сужаются на телефоне: 40px с каждой стороны оставляли тексту
// 310px из 390.
export const column: CSSProperties = { maxWidth: 780, margin: '0 auto', padding: '64px clamp(20px, 6vw, 40px) 96px' };
export const backLink: CSSProperties = { fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48 };
export const eyebrow: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' };
// «Конфиденциальности» в 32px шире 310px — заголовок раздвигал страницу.
export const h1: CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 7vw, 54px)', hyphens: 'auto', overflowWrap: 'anywhere', fontWeight: 400, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-.01em' };
export const lead: CSSProperties = { fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: 0, maxWidth: 680 };
export const inlineLink: CSSProperties = { color: 'var(--accent)', textDecoration: 'none' };
