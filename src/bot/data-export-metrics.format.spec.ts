// Блок «Забирают свои данные» в /stats.
//
// Пустое состояние проверяется первым и намеренно: на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — правило №8 требует именно этого.
import {
  formatDataExportMetrics,
  DataExportMetrics,
} from './data-export-metrics.format';

const EMPTY: DataExportMetrics = {
  totalExports: 0,
  totalUsers: 0,
  exports30: 0,
  users30: 0,
  daysSinceLast: 0,
};

describe('пустая база', () => {
  it('говорит словами, что никто не выгружал, без цифр и NaN', () => {
    const out = formatDataExportMetrics(EMPTY);

    expect(out).toContain('Пока никто не запрашивал выгрузку данных');
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('обычный отчёт', () => {
  it('показывает итог за всё время, за месяц и когда была последняя выгрузка', () => {
    const out = formatDataExportMetrics({
      totalExports: 7,
      totalUsers: 5,
      exports30: 3,
      users30: 2,
      daysSinceLast: 4,
    });

    expect(out).toContain(
      'Всего забирали данные 7 раз — 5 человек за всё время.',
    );
    expect(out).toContain('За последний месяц: 3 раза, 2 человека.');
    expect(out).toContain('Последний раз — 4 дня назад.');
  });

  it('сегодня (daysSinceLast: 0) — говорит «сегодня», а не «0 дней назад»', () => {
    const out = formatDataExportMetrics({
      totalExports: 1,
      totalUsers: 1,
      exports30: 1,
      users30: 1,
      daysSinceLast: 0,
    });

    expect(out).toContain('Последний раз — сегодня.');
    expect(out).not.toContain('0 дней назад');
  });

  it('вчера (daysSinceLast: 1) — говорит «вчера», а не «1 день назад»', () => {
    const out = formatDataExportMetrics({
      totalExports: 2,
      totalUsers: 2,
      exports30: 0,
      users30: 0,
      daysSinceLast: 1,
    });

    expect(out).toContain('Последний раз — вчера.');
    expect(out).not.toContain('1 день назад');
  });

  it('за месяц ни разу — говорит об этом словами, а не «0 раз»', () => {
    const out = formatDataExportMetrics({
      totalExports: 3,
      totalUsers: 3,
      exports30: 0,
      users30: 0,
      daysSinceLast: 45,
    });

    expect(out).toContain('За последний месяц — ни разу.');
    expect(out).not.toContain('0 раз');
  });

  it('склонение «раз/раза» и «человек/человека» верное на разных числах', () => {
    expect(
      formatDataExportMetrics({
        totalExports: 1,
        totalUsers: 1,
        exports30: 1,
        users30: 1,
        daysSinceLast: 0,
      }),
    ).toContain('Всего забирали данные 1 раз — 1 человек за всё время.');
    expect(
      formatDataExportMetrics({
        totalExports: 21,
        totalUsers: 22,
        exports30: 21,
        users30: 22,
        daysSinceLast: 0,
      }),
    ).toContain('Всего забирали данные 21 раз — 22 человека за всё время.');
  });

  it('язык простой: без англицизмов/служебных имён события', () => {
    const out = formatDataExportMetrics({
      totalExports: 7,
      totalUsers: 5,
      exports30: 3,
      users30: 2,
      daysSinceLast: 4,
    });
    expect(out).not.toMatch(/data_export|event|meta\./i);
  });
});
