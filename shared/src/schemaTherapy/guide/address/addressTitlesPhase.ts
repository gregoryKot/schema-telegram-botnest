import type { PhaseGuide } from '../phases/types';
import type { Titles } from './addressTitles';

/** Заголовки разделов листа вкладки «Путь терапии» — как на листе (PhaseGuideSheet). */
export const PHASE_TITLES: Titles<PhaseGuide> = {
  goal: 'Суть фазы',
  essence: 'Что происходит',
  timing: 'Сроки',
  tasks: 'Задачи фазы',
  stance: 'Позиция терапевта и ограниченное родительство',
  modeIds: 'Режимы в фокусе',
  techniques: 'Типичные техники',
  noteIds: 'Для терапевта',
  transition: 'Признаки перехода дальше',
  variants: 'Где книги расходятся',
  stuck: 'Где застревают',
  voice: 'Как это звучит',
  more: 'Подробнее',
};
