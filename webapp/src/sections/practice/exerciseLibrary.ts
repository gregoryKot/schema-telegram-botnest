// Каталог упражнений раздела «Практика»: данные карточек и чистые функции
// форматирования. «Давность» карточки — fmtAgo из shared (utils/format), своей
// копии здесь нет (правило №11). Экраны самих упражнений — components/exercises/*.

export type ExId = 'belief' | 'schema' | 'mode' | 'letter' | 'safe' | 'wheel' | 'warm' | 'phrase';
export interface ExStats { count: number; lastDone: string | null; }

export const EXERCISES: { id: ExId; num: string; eyebrow: string; title: string; desc: string; time: string }[] = [
  { id: 'belief', num: '01', eyebrow: 'Когнитивная работа',   title: 'Проверка убеждения',       desc: 'Поставить мысль перед судом фактов.',     time: '8–12 мин' },
  { id: 'schema', num: '02', eyebrow: 'Знакомство',            title: 'Карточка схемы',            desc: 'Семь вопросов про одну схему: триггеры, тело, истоки, здоровый взгляд.', time: '10–15 мин' },
  { id: 'mode',   num: '03', eyebrow: 'Знакомство',            title: 'Карточка режима',           desc: 'Пять вопросов: когда активируется, что чувствует, что хочет.',         time: '7–10 мин' },
  { id: 'letter', num: '04', eyebrow: 'Эмоциональная работа', title: 'Письмо Уязвимому Ребёнку', desc: 'Сказать себе в детстве то, что тогда важно было услышать.',               time: '15–25 мин' },
  { id: 'safe',   num: '05', eyebrow: 'Ресурс',                title: 'Безопасное место',          desc: 'Описать место, в которое можно мысленно возвращаться в тревогу.',      time: '5–10 мин' },
  { id: 'wheel',  num: '06', eyebrow: 'Истоки',                title: 'Колесо детства',            desc: 'Оценить базовые потребности в детстве. Найти связь с паттернами сегодня.', time: '8–12 мин' },
  { id: 'warm',   num: '07', eyebrow: 'Ресурс',                title: 'Тёплые слова',               desc: 'Слова поддержки — перечитать, когда трудно.',                            time: '2–5 мин' },
  { id: 'phrase', num: '08', eyebrow: 'Внутренний голос',      title: 'Критик или забота?',         desc: 'Разобрать фразу внутреннего голоса по девяти приметам, переписать её.', time: '6–10 мин' },
];

/** Небольшая палитра оттенков библиотеки (hue из гаммы кабинета). */
export const LIBRARY_HUES = [28, 70, 135, 240, 310, 190] as const;

/** Оттенок карточки по порядку в библиотеке: палитра по кругу, без выдуманных данных. */
export function exerciseHue(index: number): number {
  const n = LIBRARY_HUES.length;
  return LIBRARY_HUES[((index % n) + n) % n];
}

export function fmtCount(n: number): string {
  if (n === 1) return `1 запись`;
  if (n < 5) return `${n} записи`;
  return `${n} записей`;
}
