import { useLocation } from 'react-router-dom';
import type { PlanLayout } from './PlanLayoutSwitch';
import { clientCardPath } from '../clientTabRoute';

/** Раскладка плана из `?layout=phases` в адресе; нет или неизвестное значение — null (решит по наличию пути). */
export function layoutFromSearch(search: string): PlanLayout | null {
  const v = new URLSearchParams(search).get('layout');
  return v === 'phases' || v === 'channels' ? v : null;
}

/** Адрес вкладки «План работы» в раскладке по фазам. */
export function planPhasesPath(ref: string): string {
  return `${clientCardPath(ref, 'plan')}?layout=phases`;
}

/** Из строки запроса — только `layout`: раскладка плана переживает смену вкладки карточки. */
export function keepLayoutSearch(search: string): string {
  const v = layoutFromSearch(search);
  return v ? `?layout=${v}` : '';
}

/** Раскладка, с которой вкладку открыли по адресу (читается один раз, при монтировании). */
export const useLayoutFromUrl = (): PlanLayout | null => layoutFromSearch(useLocation().search);
