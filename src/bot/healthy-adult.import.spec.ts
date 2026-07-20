import {
  prepareImport,
  formatImportReport,
  MAX_PHRASE_LEN,
} from './healthy-adult.import';

describe('prepareImport — разбор пачки фраз', () => {
  it('разбивает по строкам и пропускает пустые', () => {
    const res = prepareImport('первая\n\n  \nвторая', []);
    expect(res.accepted).toEqual(['первая', 'вторая']);
    expect(res.rejected).toEqual([]);
  });

  it('снимает кавычки-обёртки и меняет длинное тире на короткое', () => {
    const res = prepareImport('«Устал — значит устал.»', []);
    expect(res.accepted).toEqual(['Устал – значит устал.']);
  });

  it('отсеивает фразу, уже лежащую в пуле', () => {
    const res = prepareImport('уже есть', ['уже есть']);
    expect(res.accepted).toEqual([]);
    expect(res.rejected[0].reason).toBe('уже есть в пуле');
  });

  it('отсеивает дубль внутри самой пачки', () => {
    const res = prepareImport('одно и то же\nодно и то же', []);
    expect(res.accepted).toEqual(['одно и то же']);
    expect(res.rejected).toHaveLength(1);
  });

  it('отсеивает совпадающий зачин (первые три слова) с фразой из пула', () => {
    const res = prepareImport('Ты сегодня уже сделал достаточно.', [
      'Ты сегодня уже ничего не должен.',
    ]);
    expect(res.accepted).toEqual([]);
    expect(res.rejected[0].reason).toContain('начинается так же');
    expect(res.rejected[0].reason).toContain('Ты сегодня уже ничего не должен');
  });

  it('отсеивает совпадающие зачины внутри пачки, оставляя первый', () => {
    const res = prepareImport(
      'Если ты снова злишься, это не поломка.\nЕсли ты снова устал, отдых не награда.',
      [],
    );
    expect(res.accepted).toEqual(['Если ты снова злишься, это не поломка.']);
    expect(res.rejected).toHaveLength(1);
  });

  it('однословные и двусловные фразы по зачину не сравниваются', () => {
    const res = prepareImport('Дыши.\nЖиви дальше.', []);
    expect(res.accepted).toEqual(['Дыши.', 'Живи дальше.']);
  });

  // Регрессия на реальную жалобу: двусловное совпадение предлога/оборота — не
  // повтор конструкции. Обе фразы должны пройти (порог — три слова).
  it('совпадение только первых двух слов не считается повтором', () => {
    const res = prepareImport(
      'Что бы сегодня ни выяснилось, ты не станешь хуже.\nЧто бы ты сказал другу на твоём месте?',
      [],
    );
    expect(res.accepted).toHaveLength(2);
  });

  it('«Ты называешь X» и «Ты называешь это» — разные, обе проходят', () => {
    const res = prepareImport(
      'Ты называешь себя ленивым, а это усталость.\nТы называешь это провалом, а это опыт.',
      [],
    );
    expect(res.accepted).toHaveLength(2);
  });

  it('отсеивает слишком длинную фразу', () => {
    const long = 'я'.repeat(MAX_PHRASE_LEN + 1);
    const res = prepareImport(long, []);
    expect(res.accepted).toEqual([]);
    expect(res.rejected[0].reason).toContain(String(MAX_PHRASE_LEN));
  });

  it('фраза ровно на границе длины проходит', () => {
    const exact = 'я'.repeat(MAX_PHRASE_LEN);
    expect(prepareImport(exact, []).accepted).toEqual([exact]);
  });
});

describe('formatImportReport — отчёт для админки', () => {
  it('пустой ввод — говорит, что нечего добавлять', () => {
    expect(formatImportReport({ accepted: [], rejected: [] })).toBe(
      'Пусто — нечего добавлять.',
    );
  });

  it('всё принято — одна строка без списка пропущенных', () => {
    const text = formatImportReport({ accepted: ['a', 'b'], rejected: [] });
    expect(text).toBe('Добавлено: 2.');
  });

  it('перечисляет пропущенные с причиной', () => {
    const text = formatImportReport({
      accepted: ['новая'],
      rejected: [{ text: 'старая', reason: 'уже есть в пуле' }],
    });
    expect(text).toContain('Добавлено: 1.');
    expect(text).toContain('Пропущено: 1.');
    expect(text).toContain('«старая» — уже есть в пуле');
  });

  it('обрезает длинный текст в отчёте, чтобы список читался', () => {
    const long = 'я'.repeat(100);
    const text = formatImportReport({
      accepted: [],
      rejected: [{ text: long, reason: 'длиннее 600 символов' }],
    });
    expect(text).toContain('…');
    expect(text).not.toContain(long);
  });
});
