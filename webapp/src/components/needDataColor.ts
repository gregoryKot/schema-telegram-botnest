// Цвет данных одной потребности (docs/design/APP_2026-11.md, «Палитра данных», решение 7):
// всё, что значит оценку конкретной потребности — точки шкалы ответа, точка прогресса трекера,
// столбик дня, линия динамики, — красится цветом данных NEED_DATA_PAPER по её месту в
// NEED_ORDER, а не BAR_PAPER по порядку на экране и не oklch(--h) на месте. Один источник —
// одна палитра на вопросе, «Готово» и в «Истории».
import type { CSSProperties } from 'react';
import { NEED_ORDER } from '../../../shared/src/needs/types';
import { NEED_DATA_PAPER } from './art/paper';

/** Цвет данных потребности; неизвестный id — undefined (без выдуманного цвета). */
export function needDataColor(id: string): string | undefined {
  const i = (NEED_ORDER as readonly string[]).indexOf(id);
  return i < 0 ? undefined : NEED_DATA_PAPER[i];
}

/** Тот же цвет CSS-переменной `--nd` для style: правила берут `var(--nd, запасной)`. */
export function needDataStyle(id: string | undefined): CSSProperties {
  const color = id ? needDataColor(id) : undefined;
  return color ? ({ '--nd': color } as CSSProperties) : {};
}
