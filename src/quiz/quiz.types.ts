// Лёгкие мини-тесты без регистрации (сайт + бот). Контент строится от формы
// обращения (правило «ты/вы» CLAUDE.md): каждая различающаяся строка в
// *.data.ts обёрнута в t(form, 'ты', 'вы'). Внутренние цитаты-голоса («…»)
// намеренно не разводятся — это дословная внутренняя речь.

export interface QuizOption {
  label: string;
  /** id результата, к которому «голосует» этот вариант */
  resultId: string;
}

export interface QuizQuestion {
  text: string;
  options: QuizOption[];
}

export interface QuizResult {
  id: string;
  emoji: string;
  title: string;
  text: string;
  /** «что с этим делать» — одна дружелюбная подсказка */
  hint: string;
}

export interface Quiz {
  /** латиница/подчёркивания: живёт в callback_data бота и в URL сайта */
  id: string;
  emoji: string;
  title: string;
  /** одна строка для списка тестов: что узнаешь */
  teaser: string;
  /**
   * Экран-старт (правило онбординга: «откуда это и зачем» — до первого
   * действия): что за тест, на чём основан, сколько займёт, что получишь.
   */
  intro: string;
  questions: QuizQuestion[];
  /**
   * Порядок = приоритет при равенстве голосов (первый выигрывает ничью).
   * Ставим более бережную/интересную трактовку выше.
   */
  results: QuizResult[];
}
