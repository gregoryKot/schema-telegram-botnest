// Три стиля копинга — одно описание на все места: колонки таблицы «Справочника», лист схемы, значки
// на холсте. У стиля один знак (SignArt, ключ из SIGN_KEYS) и один цвет во всём приложении: заливка
// --coping-* (знак, полоска, плашка через color-mix) и текст --coping-*-ink (токены — webapp/src/index.css,
// имена — SHARED_NAME_ONLY_TOKENS в scripts/check-token-contract.mjs).
import type { SignKey } from '../../theme/signKeys';
import type { SchemaCoping } from './types';

export type CopingStyleId = keyof SchemaCoping;

export interface CopingStyle {
  id: CopingStyleId;
  label: string;
  /** Что человек делает со схемой — строка-пояснение у знака. */
  gist: string;
  sign: SignKey;
  /** Заливка: знак, полоска у клетки, плашка через color-mix. */
  color: string;
  /** Текст цветом стиля (≥4.5:1 к бумаге). */
  ink: string;
}

/** Порядок — как в листе схемы: капитуляция, избегание, гиперкомпенсация. */
export const COPING_STYLES: readonly CopingStyle[] = [
  {
    id: 'surrender',
    label: 'Капитуляция',
    gist: 'живёт так, будто схема права',
    sign: 'coping_surrender',
    color: 'var(--coping-surrender)',
    ink: 'var(--coping-surrender-ink)',
  },
  {
    id: 'avoidance',
    label: 'Избегание',
    gist: 'обходит всё, что может её включить',
    sign: 'coping_avoidance',
    color: 'var(--coping-avoidance)',
    ink: 'var(--coping-avoidance-ink)',
  },
  {
    id: 'overcompensation',
    label: 'Гиперкомпенсация',
    gist: 'ведёт себя так, будто верно обратное',
    sign: 'coping_overcompensation',
    color: 'var(--coping-overcompensation)',
    ink: 'var(--coping-overcompensation-ink)',
  },
];
