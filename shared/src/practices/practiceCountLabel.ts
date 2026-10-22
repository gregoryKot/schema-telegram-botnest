// Подпись счётчика прохождений для canvas-карточки и шаринга — без формы
// обращения и рода (как в shareTexts.ts). Отдельный модуль, чтобы сайт, которому
// нужна только подпись, не тянул за ней app-вёрстку подвала.
import { pluralRu } from '../utils/pluralRu';

export function practiceCountLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return `прошли ${count} ${pluralRu(count, 'раз', 'раза', 'раз')}`;
}
