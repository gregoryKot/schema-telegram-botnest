// Блок «Данные записей» в /stats.
//
// Пустое состояние проверяется первым и намеренно: на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — правило №8 требует именно этого.
import {
  BookingRetentionMetrics,
  formatBookingRetention,
} from './booking-retention-metrics.format';

const EMPTY: BookingRetentionMetrics = {
  monthsKept: 12,
  anonymized: 0,
  waiting: 0,
  daysToNext: null,
};

const junk = (out: string) => {
  expect(out).not.toContain('NaN');
  expect(out).not.toContain('undefined');
  expect(out).not.toContain('null');
};

describe('пустая база', () => {
  it('говорит словами, что записей нет и стирать нечего, без нулей и NaN', () => {
    const out = formatBookingRetention(EMPTY);

    expect(out).toContain('🗂 <b>Данные записей</b>');
    expect(out).toContain('Записей пока нет, стирать нечего.');
    // Правило срока названо и тут: блок объясняет себя сам, даже когда пуст.
    expect(out).toContain('через 12 месяцев после встречи');
    expect(out).not.toMatch(/\b0\b/);
    junk(out);
  });
});

describe('ничего ещё не стёрто', () => {
  it('записи есть, срок ни у кого не вышел: говорит это словами, без «0 записей»', () => {
    const out = formatBookingRetention({
      ...EMPTY,
      waiting: 3,
      daysToNext: 40,
    });

    expect(out).toContain(
      'Пока не стёрто ни у одной: срок ещё ни у кого не вышел.',
    );
    expect(out).toContain('Своего срока ждут 3 записи.');
    expect(out).toContain('Ближайший срок — через 40 дней.');
    expect(out).not.toMatch(/\b0\b/);
    junk(out);
  });
});

describe('обычный отчёт', () => {
  it('показывает сколько стёрто, сколько ждут и когда ближайший срок', () => {
    const out = formatBookingRetention({
      monthsKept: 12,
      anonymized: 5,
      waiting: 8,
      daysToNext: 12,
    });

    expect(out).toContain('Уже стёрто у 5 записей.');
    expect(out).toContain('Своего срока ждут 8 записей.');
    expect(out).toContain('Ближайший срок — через 12 дней.');
    expect(out).toContain('Сама запись остаётся.');
    junk(out);
  });

  it('склоняет «записи/записей» и «запись/записи/записей» по числу', () => {
    const f = (anonymized: number, waiting: number) =>
      formatBookingRetention({ ...EMPTY, anonymized, waiting, daysToNext: 7 });

    expect(f(1, 1)).toContain('Уже стёрто у 1 записи.');
    expect(f(1, 1)).toContain('Своего срока ждут 1 запись.');
    expect(f(2, 2)).toContain('Уже стёрто у 2 записей.');
    expect(f(2, 2)).toContain('Своего срока ждут 2 записи.');
    expect(f(21, 21)).toContain('Уже стёрто у 21 записи.');
    expect(f(11, 11)).toContain('Своего срока ждут 11 записей.');
  });

  it('склоняет «дней»: 1 — завтра, 2 — дня, 21 — день', () => {
    const f = (daysToNext: number) =>
      formatBookingRetention({ ...EMPTY, waiting: 1, daysToNext });

    expect(f(1)).toContain('Ближайший срок — завтра.');
    expect(f(2)).toContain('Ближайший срок — через 2 дня.');
    expect(f(21)).toContain('Ближайший срок — через 21 день.');
    expect(f(11)).toContain('Ближайший срок — через 11 дней.');
  });

  it('срок подошёл сегодня (0): «сотрётся ночью», а не «через 0 дней»', () => {
    const out = formatBookingRetention({ ...EMPTY, waiting: 1, daysToNext: 0 });

    expect(out).toContain('срок подошёл — сотрётся ночью');
    expect(out).not.toContain('через 0');
    expect(out).not.toContain('⚠️');
  });

  it('все стёрты, ждущих нет: так и говорит, не печатает «0 записей» и дату', () => {
    const out = formatBookingRetention({
      ...EMPTY,
      anonymized: 4,
      waiting: 0,
      daysToNext: null,
    });

    expect(out).toContain('Уже стёрто у 4 записей.');
    expect(out).toContain('Ждущих срока записей нет.');
    expect(out).not.toContain('Ближайший срок');
    junk(out);
  });
});

describe('ночное стирание опаздывает', () => {
  it('срок вышел раньше, а запись не стёрта: предупреждение с числом дней', () => {
    const out = formatBookingRetention({
      monthsKept: 12,
      anonymized: 2,
      waiting: 6,
      daysToNext: -3,
    });

    expect(out).toContain(
      '⚠️ Ночное стирание опаздывает: у самой старой записи срок вышел 3 дня назад.',
    );
    expect(out).not.toContain('Ближайший срок');
    junk(out);
  });

  it('один день — «1 день назад»', () => {
    const out = formatBookingRetention({
      ...EMPTY,
      waiting: 1,
      daysToNext: -1,
    });

    expect(out).toContain('срок вышел 1 день назад');
  });
});

describe('срок хранения в тексте', () => {
  it('берёт число месяцев из данных, а не из зашитого «12»', () => {
    const out = formatBookingRetention({ ...EMPTY, monthsKept: 6 });

    expect(out).toContain('через 6 месяцев после встречи');
    expect(out).not.toContain('12');
  });

  it('один месяц склоняется как «месяц»', () => {
    expect(formatBookingRetention({ ...EMPTY, monthsKept: 1 })).toContain(
      'через 1 месяц после встречи',
    );
  });
});
