// Вид кризисной карточки (CrisisCard.tsx) — инлайном: карточку берут и кабинет, и визитка (BookingCrisisNote),
// CSS экрана туда не доезжает. Только токены и бумага по --h (.pp-paper); номера — строки между тонкими линиями, без плашек.
import type { CSSProperties } from 'react';
import { ENTITY_LOOK } from '../theme/entityLook';

/** Бумага карточки — «бережная» роза «Мне плохо» (ENTITY_LOOK.sos). */
export const CRISIS_HUE = ENTITY_LOOK.sos.hue;

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
    marginTop: 14,
    maxWidth: 680,
    borderTop: '1px solid var(--panel-line)',
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 2,
    boxSizing: 'border-box',
    minWidth: 0,
    padding: '8px 2px',
    borderBottom: '1px solid var(--panel-line)',
    textDecoration: 'none',
    fontFamily: 'var(--sans)',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--accent)',
  },
  // Взрослая линия — главная цель нажатия в продукте: крупный номер первой строкой.
  main: {
    minHeight: 60,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '.01em',
  },
  // Детская линия — второй строкой, тише: тот же ряд, номер мельче.
  sub: {
    minHeight: 52,
    fontSize: 18,
    fontWeight: 700,
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
