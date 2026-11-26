// Знаки «Для терапевта» по Рафаэли, Бернштейну и Янгу: четыре пути к схеме — круг потребностей (need_ring);
// режим как состояние — три части (three_parts): у каждого несколько частей, у руля одна.
import type { GuideSign } from './guideSignsModel';

export const RAFAELI_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  childhood_experience_types: 'need_ring',
  mode_states: 'three_parts',
};
