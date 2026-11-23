import type { NeedGuide } from '../needTypes';
import type { Titles } from './addressTitles';

/** Заголовки разделов листа потребности — как на листе (NeedGuideSheet). */
export const NEED_TITLES: Titles<NeedGuide, 'domainNote'> = {
  essence: 'Суть',
  frustration: 'Фрустрация в детстве',
  schemas: 'Схемы домена',
  care: 'Ограниченное родительство',
  domainNote: 'Общее для домена',
};
