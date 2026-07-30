import { formatModeDiaryMetrics } from './mode-diary-metrics.format';

describe('formatModeDiaryMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatModeDiaryMetrics({
      saves7: 0,
      saves30: 0,
      withHealthy30: 0,
      testCompleted7: 0,
      testCompleted30: 0,
    });
    expect(text).toContain('Дневник режимов');
    expect(text).toContain(
      'Пока никто не вёл дневник режимов и не проходил тест.',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('заполненная БД — записи, ответ Здорового Взрослого и тест', () => {
    const text = formatModeDiaryMetrics({
      saves7: 5,
      saves30: 20,
      withHealthy30: 12,
      testCompleted7: 3,
      testCompleted30: 9,
    });
    expect(text).toContain('Записей за неделю: 5 · за месяц: 20');
    expect(text).toContain('дописывали ответ Здорового Взрослого: 12');
    expect(text).toContain(
      'Определяли режим тестом за неделю: 3 · за месяц: 9',
    );
    expect(text).not.toMatch(/NaN|undefined|events|mode_entry_saved/);
  });

  it('записи есть, тест не проходили — блок про тест не показывается', () => {
    const text = formatModeDiaryMetrics({
      saves7: 2,
      saves30: 6,
      withHealthy30: 1,
      testCompleted7: 0,
      testCompleted30: 0,
    });
    expect(text).toContain('Записей за неделю: 2 · за месяц: 6');
    expect(text).not.toContain('Определяли режим тестом');
  });

  it('тест проходили, записей нет — блок про записи не в пустом состоянии', () => {
    const text = formatModeDiaryMetrics({
      saves7: 0,
      saves30: 0,
      withHealthy30: 0,
      testCompleted7: 1,
      testCompleted30: 4,
    });
    expect(text).toContain(
      'Определяли режим тестом за неделю: 1 · за месяц: 4',
    );
    expect(text).not.toContain('Пока никто');
  });
});
