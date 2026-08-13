// Блок «Откуда пришли новенькие» в /stats.
//
// Пустое состояние проверяется первым и намеренно: на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — правило №8 требует именно этого.
import { formatSignupSourceMetrics } from './signup-source-metrics.format';
import {
  SIGNUP_SOURCES,
  type SignupSource,
} from '../analytics/signup-sources.constants';

const emptyBySource = () =>
  SIGNUP_SOURCES.map((src) => ({ src, count7: 0, count30: 0 }));

const EMPTY = { total7: 0, total30: 0, bySource: emptyBySource() };

const withSource = (
  src: SignupSource,
  count7: number,
  count30: number,
): ReturnType<typeof emptyBySource> =>
  emptyBySource().map((b) => (b.src === src ? { src, count7, count30 } : b));

describe('пустая база', () => {
  it('говорит словами, что переходов не было, без цифр и NaN', () => {
    const out = formatSignupSourceMetrics(EMPTY);

    expect(out).toContain('Пока никто не пришёл по помеченной ссылке');
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('обычный отчёт', () => {
  it('показывает итог за месяц/неделю и разбивку по источникам', () => {
    const out = formatSignupSourceMetrics({
      total7: 4,
      total30: 12,
      bySource: [
        { src: 'seed1', count7: 3, count30: 10 },
        { src: 'seed2', count7: 0, count30: 0 },
        { src: 'channel', count7: 1, count30: 2 },
        { src: 'therapist', count7: 0, count30: 0 },
        { src: 'other', count7: 0, count30: 0 },
      ],
    });

    expect(out).toContain('Всего пришло по ссылкам: 12 за месяц, 4 за неделю');
    expect(out).toContain('Посев №1: 10 за месяц, 3 за неделю');
    expect(out).toContain('Свой канал: 2 за месяц, 1 за неделю');
  });

  it('источник без событий за месяц не попадает в список (нет мусорных нулей)', () => {
    const out = formatSignupSourceMetrics({
      total7: 0,
      total30: 5,
      bySource: withSource('seed1', 0, 5),
    });

    expect(out).toContain('Посев №1: 5 за месяц, 0 за неделю');
    expect(out).not.toContain('Посев №2');
    expect(out).not.toContain('Свой канал');
    expect(out).not.toContain('терапевтов-партнёров');
    expect(out).not.toContain('Без метки');
  });

  it('неизвестный/мусорный источник виден в отчёте под «Без метки»', () => {
    const out = formatSignupSourceMetrics({
      total7: 1,
      total30: 1,
      bySource: withSource('other', 1, 1),
    });

    expect(out).toContain(
      'Без метки/непонятно откуда: 1 за месяц, 1 за неделю',
    );
  });

  it('каждый источник из allow-list имеет человеческую подпись (не голый slug)', () => {
    // Косвенно проверяет полноту SOURCE_LABELS: если бы кто-то добавил новый
    // slug в SIGNUP_SOURCES без подписи, TS уже не даст скомпилироваться
    // (Record<SignupSource, string>) — здесь фиксируем поведение форматтера.
    for (const src of SIGNUP_SOURCES) {
      const out = formatSignupSourceMetrics({
        total7: 1,
        total30: 1,
        bySource: withSource(src, 1, 1),
      });
      expect(out).not.toContain(`• ${src}:`);
    }
  });
});
