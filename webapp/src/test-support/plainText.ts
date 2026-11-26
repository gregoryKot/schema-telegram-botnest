// Текст элемента так, как его прочтёт человек, — без невидимых знаков склейки. Строки примитивов склеиваются
// при отрисовке (glue, shared/src/utils/typo.ts: PaperAlert, DoneSheet, EntitySheet, лента «Записей»):
// неразрывный пробел после короткого слова и перед тире, неразрывный дефис (U+2011) в «схема-терапии»,
// «кто-то», «4-4-6» и связка U+2060 в диапазоне «3–5». Проверка по фразе не должна зависеть от склейки;
// что склейка есть, проверяет тест самого примитива (PaperAlert.test.tsx) и typo.test.ts.
export const plain = (s: string): string =>
  s.replace(/\u00a0/g, ' ').replace(/\u2011/g, '-').replace(/\u2060/g, '');

export const plainText = (el: Element | null | undefined): string =>
  plain(el?.textContent ?? '');

/** Матчер для getByText: элемент, чей текст без знаков склейки равен фразе (сам элемент, а не его предок). */
export const byPlainText =
  (phrase: string) =>
  (_: string, el: Element | null): boolean =>
    !!el &&
    plainText(el) === phrase &&
    Array.from(el.children).every((c) => plainText(c) !== phrase);
