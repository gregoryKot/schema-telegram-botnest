// Вид кризисной карточки (CrisisCard.tsx) — инлайном: карточку берут и кабинет, и визитка
// (BookingCrisisNote), CSS экрана туда не доезжает. Только токены и бумага по --h (.pp-paper);
// тень плашки — сплошной сдвинутый слой тоном бумаги, без размытия.
import type { CSSProperties } from 'react';

/** Бумага карточки — «бережная» роза (ENTITY_LOOK.sos, PAPER_HUE.rose). */
export const CRISIS_HUE = 25;

export const CRISIS_CARD_STYLE = {
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  art: { display: 'var(--crisis-card-art)', flexShrink: 0 }, // inline-flex — с карточки (CrisisCard.tsx), экран может погасить
  label: { display: 'block', margin: '0 0 4px', color: 'var(--text-sub)' },
  title: {
    margin: 0,
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 20,
    lineHeight: 1.25,
    color: 'var(--text)',
    textWrap: 'balance',
  },
  lead: {
    margin: '10px 0 0',
    fontSize: 14.5,
    lineHeight: 1.55,
    color: 'var(--text-sub)',
  },
  // Линии — всегда столбиком (правило №7): взрослая плашка во всю ширину (до 680), детская — под ней.
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
    maxWidth: 680,
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 2,
    boxSizing: 'border-box',
    minWidth: 0,
    padding: '8px 18px',
    borderRadius: 16,
    textDecoration: 'none',
    fontFamily: 'var(--sans)',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--accent)',
  },
  // Взрослая линия — главная цель нажатия в продукте: белая плашка, тень — сплошной слой тоном бумаги.
  main: {
    minHeight: 56,
    fontSize: 21,
    fontWeight: 700,
    letterSpacing: '.01em',
    background: 'var(--surface)',
    boxShadow: '4px 5px 0 oklch(0.84 0.05 var(--h, 25))',
  },
  // Детская линия — второй строкой, тише: контурная плашка без заливки и тени — второстепенная кнопка.
  sub: {
    minHeight: 52,
    fontSize: 16,
    fontWeight: 700,
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--text) 16%, transparent)',
  },
  note: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-sub)',
    fontVariantNumeric: 'normal',
  },
  foot: {
    margin: '12px 0 0',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: 'var(--text-sub)',
  },
} satisfies Record<string, CSSProperties>;
