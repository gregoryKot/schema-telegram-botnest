// Форматтер блока «Переходы к автору-терапевту» в /stats: полные данные и
// пустая БД (без NaN/мусора), язык без терминов (правило №8).
import {
  formatPracticeLinkMetrics,
  PracticeLinkMetrics,
} from './practice-link-metrics.format';

const FULL: PracticeLinkMetrics = {
  total30: 8,
  author30: 5,
  footer30: 2,
  faq30: 1,
};

const EMPTY: PracticeLinkMetrics = {
  total30: 0,
  author30: 0,
  footer30: 0,
  faq30: 0,
};

describe('formatPracticeLinkMetrics', () => {
  it('полные данные: итог и разбивка по местам простым языком', () => {
    const text = formatPracticeLinkMetrics(FULL);
    expect(text).toContain('Переходы к автору-терапевту');
    expect(text).toContain(
      'Переходили на сайт практики: 8 ' +
        '(из блока об авторе — 5, из подвала — 2, из вопросов — 1)',
    );
    // Язык без терминов: никаких сырых ключей события и англицизмов.
    expect(text).not.toMatch(/practice|link|click|place|author|footer|faq/i);
  });

  it('пустая БД: дружелюбная строка, без NaN и нулевого мусора', () => {
    const text = formatPracticeLinkMetrics(EMPTY);
    expect(text).toContain('Пока никто не переходил');
    expect(text).not.toMatch(/NaN|undefined|0 \(/);
  });
});
