import { formatScreenShareMetrics } from './screen-share-metrics.format';

describe('formatScreenShareMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatScreenShareMetrics({ on30: 0, therapists30: 0 });
    expect(text).toContain('🖥 <b>Показ экрана в кабинете</b> (за месяц)');
    expect(text).toContain(
      'Пока никто из терапевтов не прятал список клиентов на время показа экрана.',
    );
    expect(text).not.toMatch(/NaN|undefined|\b0 раз/);
  });

  it('с данными — сколько раз и сколько терапевтов', () => {
    const text = formatScreenShareMetrics({ on30: 7, therapists30: 3 });
    expect(text).toContain(
      'Прятали список клиентов на время показа экрана 7 раз, терапевтов: 3',
    );
    expect(text).not.toContain('Пока никто');
  });
});
