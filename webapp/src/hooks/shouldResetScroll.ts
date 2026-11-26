// Окно на сайте одно на все разделы, и «Записи», прокрученные вниз, оставляли «Сегодня»
// на той же позиции (QA 2026-11, C-З3). «Назад»/«Вперёд» (POP) не трогаем: браузер сам
// возвращает позицию. Тот же адрес (лист кладёт запись с тем же путём) и replace — тоже.
export function shouldResetScroll(prevPath: string, path: string, navType: string): boolean {
  return navType === 'PUSH' && prevPath !== path;
}

