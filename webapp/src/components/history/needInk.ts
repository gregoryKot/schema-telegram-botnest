// Цвет потребности в истории — решение 7 «Палитра данных» (docs/design/APP_2026-11.md): одна
// потребность — один цвет и в колесе, и в линиях недели, и в числах строк. Графика (лепесток,
// линия) — needDataColor (needDataColor.ts, единственный источник палитры данных, тот же цвет,
// что у шкалы трекера и полосок дня). Здесь только своё: число текстом — читаемый вариант того же
// оттенка (*-strong или --accent-* — текстовые алиасы, правило frontend-visual): ≥4.5:1 к белой
// строке и ≥3:1 к бумаге своей потребности (крупная цифра карточки недели). Сверка — needInk.test.ts.
import { NEED_ORDER, type NeedId } from '../../../../shared/src/needs/types';
import { needDataColor } from '../needDataColor';

export const NEED_TEXT_INK: Record<NeedId, string> = {
  attachment: 'var(--c-clay-strong)',
  autonomy: 'var(--c-amber-strong)',
  expression: 'var(--accent-blue)',
  play: 'var(--accent-pink)',
  limits: 'var(--c-moss-strong)',
};

/** Цвет графики для колеса дня (NeedsWheel `ink`): по needDataColor для каждой из пяти. */
export const NEED_INK = Object.fromEntries(NEED_ORDER.map((id) => [id, needDataColor(id)!])) as Record<NeedId, string>;

/** Переменные цвета потребности для строки или карточки: --need-ink (графика), --need-text (число). */
export function inkVars(id: string): Record<'--need-ink' | '--need-text', string> {
  const ink = needDataColor(id);
  return ink
    ? { '--need-ink': ink, '--need-text': NEED_TEXT_INK[id as NeedId] }
    : { '--need-ink': 'var(--text-sub)', '--need-text': 'var(--text)' };
}
