import type { NeedId } from './types';

// Цвет карточки подсказки по потребности. Домен и список схем – в shared
// (`CHILDHOOD_SCHEMA_HINTS`, `hintSchemas`), здесь только оформление мини-аппа.
export const HINT_COLOR: Record<NeedId, string> = {
  attachment: 'var(--accent-red)',
  autonomy: 'var(--accent-orange)',
  expression: 'var(--accent-green)',
  play: 'var(--accent-indigo)',
  limits: 'var(--accent-yellow)',
};
