import { layoutFromSearch } from './planLayoutParam';

/** Из строки запроса — только `layout`: раскладка плана переживает смену вкладки карточки. */
export function keepLayoutSearch(search: string): string {
  const v = layoutFromSearch(search);
  return v ? `?layout=${v}` : '';
}
