// Тексты и типы шапки вкладки «Концептуализация», общие для меню «⋯ Ещё»
// (ConceptTabHead), панели листа (ConceptGraphToolbar) и раскрывашек
// (ConceptFoldouts). Отдельно от компонентов — ради react-refresh.
interface Action { busy: boolean; failed: boolean }

/** Действия вида «Схема», которые ClientConceptGraph отдаёт в меню шапки. */
export interface GraphActions {
  image: Action & { download: () => void };
  canvas?: Action & { open: () => void };
  expand: () => void;
}

// Подсказки пунктов меню «⋯ Ещё»: видны строкой под названием, не в title (раскрытие не только по hover).
export const CANVAS_HINT = 'Новая карта режимов из этой схемы: можно двигать фигуры, дописывать и рисовать связи';
export const EXPAND_HINT = 'Схема на всё окно: на широком экране встаёт в четыре колонки';

/** Что сейчас делает выбранное в меню действие — или чем оно кончилось. */
export function actionStatusText(
  graph: GraphActions | undefined,
  exportCopied: boolean,
  tr: (ty: string, vy: string) => string,
): { text: string; err: boolean } | null {
  if (graph?.image.failed) return { err: true, text: tr('Не удалось сохранить картинку. Попробуй ещё раз.', 'Не удалось сохранить картинку. Попробуйте ещё раз.') };
  if (graph?.canvas?.failed) return { err: true, text: tr('Не получилось перенести на холст. Попробуй ещё раз.', 'Не получилось перенести на холст. Попробуйте ещё раз.') };
  if (graph?.canvas?.busy) return { err: false, text: 'Переношу на холст…' };
  if (graph?.image.busy) return { err: false, text: 'Готовлю картинку…' };
  if (exportCopied) return { err: false, text: 'Текст скопирован' };
  return null;
}

/** Заголовок сверки: сколько схем из теста ещё не в концептуализации. */
export function ysqFoldTitle(missing: number): string {
  return missing === 0 ? 'Сверка с YSQ · всё учтено' : `Сверка с YSQ · ${missing} не в концептуализации`;
}
