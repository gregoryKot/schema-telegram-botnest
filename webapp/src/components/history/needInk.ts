// Цвет данных потребности в истории — решение 7 «Палитра данных» (docs/design/APP_2026-11.md):
// одна потребность — один цвет и в колесе, и в линиях недели, и в числах строк, тот же, что у
// полосок Strokes values на главной. Графика (лепесток, линия) — NEED_DATA_PAPER: ≥3:1 к бумаге
// любого оттенка. Число текстом — читаемый вариант того же оттенка (*-strong): ≥4.5:1 к белой
// строке и ≥3:1 к бумаге своей потребности (крупная цифра карточки недели). Сверка — needInk.test.ts.
import { NEED_ORDER, type NeedId } from '../../../../shared/src/needs/types';
import { NEED_DATA_PAPER } from '../art/paper';

export const NEED_INK = Object.fromEntries(NEED_ORDER.map((id, i) => [id, NEED_DATA_PAPER[i]])) as Record<NeedId, string>;

export const NEED_TEXT_INK: Record<NeedId, string> = {
  attachment: 'var(--c-clay-strong)',
  autonomy: 'var(--c-amber-strong)',
  expression: 'var(--c-slate)',
  play: 'var(--c-plum)',
  limits: 'var(--c-moss-strong)',
};

/** Переменные цвета потребности для строки или карточки: --need-ink (графика), --need-text (число). */
export function inkVars(id: string): Record<'--need-ink' | '--need-text', string> {
  const known = (NEED_ORDER as readonly string[]).includes(id);
  return known
    ? { '--need-ink': NEED_INK[id as NeedId], '--need-text': NEED_TEXT_INK[id as NeedId] }
    : { '--need-ink': 'var(--text-sub)', '--need-text': 'var(--text)' };
}
