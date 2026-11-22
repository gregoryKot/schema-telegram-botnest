/**
 * Полка книг «Справочника»: метка в квадратных скобках → книга. Ссылка вида
 * «[Кембридж, гл. 8]» обязана вести на полку (сверка — sources.test.ts);
 * ссылка с годом («[Линехан, 1993]») — обычная библиография, полка ей не нужна.
 * Новая книга — строка здесь; как книга попадает в справочник —
 * навык .claude/skills/book-to-guide/. `title` ставится только сверенный с книгой.
 */
export interface GuideSource {
  /** Метка, которой книгу цитируют в тексте. */
  key: string;
  /** Другие написания той же метки. */
  aliases?: string[];
  /** Авторы или редакторы. */
  author?: string;
  /** Название и год издания; нет — на листе остаётся одна метка. */
  title?: string;
}

export const GUIDE_SOURCES: GuideSource[] = [
  {
    key: 'Кембридж',
    author:
      'R. Brockman, S. Simpson, C. Hayes, R. van der Wijngaart, M. Smout (ред.)',
    title: 'The Cambridge Guide to Schema Therapy, 2023',
  },
  {
    key: 'Арнтц',
    aliases: ['Арнц и Якоб'],
    author: 'A. Arntz, G. Jacob',
    title: 'Schema Therapy in Practice, 2013',
  },
  {
    key: 'Арнтц ПРЛ',
    aliases: ['Арнц и ван Гендерен'],
    author: 'А. Арнц, Х. ван Гендерен',
    title: 'Схема-терапия пограничного расстройства личности, 2-е изд., 2021',
  },
  {
    key: 'Янг',
    aliases: ['Янг, Клоско, Вайсхаар'],
    author: 'Дж. Янг, Дж. Клоско, М. Вайсхаар',
    title: 'Схема-терапия. Практическое руководство, 2020 (оригинал — 2003)',
  },
  {
    key: 'Рафаэли',
    author: 'Э. Рафаэли, Д. Ф. Бернштейн, Дж. Янг',
    title: 'Схема-терапия. Отличительные особенности',
  },
  {
    key: 'Келлогг',
    author: 'С. Келлогг',
    title: 'Техника «пустого стула» как механизм изменений',
  },
  {
    key: 'Хис',
    author: 'Дж. Хис, Х. Стартап',
    title: 'Креативные методы в схема-терапии',
  },
  {
    key: 'Рёдигер',
    author: 'Э. Рёдигер, Б. А. Стивенс, Р. Брокман',
    title: 'Контекстуальная схема-терапия',
  },
  {
    key: 'Якоб',
    author: 'Г. Якоб',
    title: 'Не наступай на одни и те же грабли, 2022',
  },
  {
    key: 'Фаррелл',
    author: 'Дж. Фаррелл, Н. Рейсс, А. Шоу',
    title: 'Клиническое руководство по схема-терапии, 2020',
  },
  {
    key: 'Босуэлл',
    author: 'Дж. Ф. Босуэлл, М. Дж. Константино',
    title: 'Намеренная практика в когнитивно-поведенческой терапии, 2021',
  },
  {
    key: 'Касьяник',
    author: 'П. М. Касьяник, Е. В. Романова',
    title: 'Диагностика ранних дезадаптивных схем',
  },
  {
    key: 'Бехари',
    author: 'В. Бехари',
    title:
      'Обезоружить нарцисса. Как выжить и стать счастливым рядом с эгоцентриком, 2-е изд., 2013 (рус. изд. 2019)',
  },
  {
    key: 'Статьи',
    title:
      'Research Articles on Schema Therapy in Major Scientific Journals, 1992–2018',
  },
];

const BY_LABEL = new Map(
  GUIDE_SOURCES.flatMap((s) =>
    [s.key, ...(s.aliases ?? [])].map((label) => [label, s] as const),
  ),
);

const YEAR = /\b(19|20)\d{2}\b/;

/** Метки полки в тексте по порядку появления, без повторов; ссылки с годом пропускаются. */
export function citationLabels(text: string): string[] {
  const labels = new Set<string>();
  for (const [, inner] of text.matchAll(/\[([^[\]]+)\]/g)) {
    for (const part of inner.split(';')) {
      if (YEAR.test(part)) continue;
      const alias = [...BY_LABEL.keys()].find(
        (l) =>
          l.includes(',') &&
          /^(,|$)/.test(part.trim().slice(l.length)) &&
          part.trim().startsWith(l),
      );
      const label = alias ?? part.split(',')[0].trim();
      if (label) labels.add(label);
    }
  }
  return [...labels];
}

/** Книги полки, на которые ссылается текст; незнакомая метка пропускается. */
export function citedSources(text: string): GuideSource[] {
  const found = new Set<GuideSource>();
  for (const label of citationLabels(text)) {
    const source = BY_LABEL.get(label);
    if (source) found.add(source);
  }
  return [...found];
}

/** Строка расшифровки на листе: «Кембридж — авторы, «название»»; без автора и названия — null. */
export function sourceLine(s: GuideSource): string | null {
  const parts = [s.author, s.title && `«${s.title}»`].filter(Boolean);
  return parts.length ? `${s.key} — ${parts.join(', ')}` : null;
}
