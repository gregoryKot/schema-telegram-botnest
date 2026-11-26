// Группы вкладок «Техники» и «Для терапевта» справочника (#1484): закрытые списки в порядке показа. Запись знает
// свою группу полем `group` (types.ts); экран раскладывает по полю. Первые четыре группы техник — каналы метода
// GUIDE_CHANNELS: те же подписи у режима, плана и справочника. Новая группа — решение владельца.
import { GUIDE_CHANNELS } from '../../therapy/plan/planItem';
import type { PracticeGroupId, TechniqueGroupId } from './types';

export interface GuideGroup<Id extends string> {
  id: Id;
  /** Заголовок: у техник — книжный термин. */
  title: string;
  /** Подпись простыми словами; у групп «Для терапевта» её нет — заголовок уже простой. */
  hint?: string;
}

export const TECHNIQUE_GROUPS: readonly GuideGroup<TechniqueGroupId>[] = [
  ...GUIDE_CHANNELS,
  {
    id: 'formulation',
    title: 'Концептуализация с клиентом',
    hint: 'карта и история вместе',
  },
  {
    id: 'borrowed',
    title: 'Из других подходов',
    hint: 'что сочетается со схема-терапией',
  },
];

export const PRACTICE_GROUPS: readonly GuideGroup<PracticeGroupId>[] = [
  { id: 'start', title: 'Начало и концептуализация' },
  { id: 'stuck', title: 'Когда буксует' },
  { id: 'hard', title: 'Трудные моменты' },
  { id: 'therapist', title: 'Терапевт и формат' },
  { id: 'method', title: 'О методе' },
];
