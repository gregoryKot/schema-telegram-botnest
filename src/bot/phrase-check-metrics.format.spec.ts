// Форматтер блока «Разбор фразы» в /stats: полные данные, пустая БД (без
// NaN и голых ключей), подписи примет без словаря и сверка с реестром
// PHRASE_MARK_IDS — новая примета без подписи вылезла бы в отчёт как id.
import {
  formatPhraseCheckMetrics,
  PHRASE_MARK_LABELS,
  PhraseCheckMetrics,
} from './phrase-check-metrics.format';
import { PHRASE_MARK_IDS } from './phrase-check.constants';

const FULL: PhraseCheckMetrics = {
  checks30: 40,
  users30: 17,
  withRewrite30: 30,
  marks30: [
    { mark: 'person', count: 31 },
    { mark: 'shame', count: 20 },
    { mark: 'absolute', count: 12 },
  ],
};

const EMPTY: PhraseCheckMetrics = {
  checks30: 0,
  users30: 0,
  withRewrite30: 0,
  marks30: [],
};

describe('formatPhraseCheckMetrics', () => {
  it('полные данные: сколько разборов, людей, дошли до переписывания', () => {
    const text = formatPhraseCheckMetrics(FULL);
    expect(text).toContain('Разобрали фраз: 40 · людей: 17');
    expect(text).toContain('Дошли до переписывания: 30 (75%)');
    expect(text).toContain('ругает не поступок, а себя — 31');
    // Язык отчёта — без терминов и внутренних id (правило №8).
    expect(text).not.toMatch(/person|shame|absolute|rewrite|marks|check/i);
  });

  it('пустая БД: дружелюбная строка, без NaN и процентов', () => {
    const text = formatPhraseCheckMetrics(EMPTY);
    expect(text).toContain('Пока никто не разбирал');
    expect(text).not.toMatch(/NaN|%|undefined/);
  });

  it('разборов нет, а приметы откуда-то есть — отчёт не делит на ноль', () => {
    const text = formatPhraseCheckMetrics({ ...FULL, checks30: 0 });
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
  });

  it('у каждой приметы из реестра есть человеческая подпись', () => {
    for (const id of PHRASE_MARK_IDS) {
      expect(PHRASE_MARK_LABELS[id]).toBeTruthy();
    }
  });

  it('неизвестная примета не роняет отчёт — печатается как есть', () => {
    const text = formatPhraseCheckMetrics({
      ...FULL,
      marks30: [{ mark: 'новая_примета', count: 3 }],
    });
    expect(text).toContain('новая_примета — 3');
  });
});
