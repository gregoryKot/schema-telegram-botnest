// Блок «Перенос данных из другого приложения» в /stats.
//
// Пустое состояние проверяется первым и намеренно: на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — правило №8 требует именно этого, и без
// такого теста форматтер уезжает на прод с «Начинали переносить: 0 раз (0 )».
import { formatAccountLinkMetrics } from './account-link-metrics.format';

const EMPTY = {
  started30: 0,
  startedUsers30: 0,
  confirmed30: 0,
  merged30: 0,
  failed30: 0,
};

describe('пустая база', () => {
  it('говорит словами, что переносов не было, без цифр и NaN', () => {
    const out = formatAccountLinkMetrics(EMPTY);

    expect(out).toContain('Пока никто не переносил данные');
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('обычный отчёт', () => {
  it('показывает начали / довели / не вышло', () => {
    const out = formatAccountLinkMetrics({
      started30: 10,
      startedUsers30: 7,
      confirmed30: 6,
      merged30: 6,
      failed30: 2,
    });

    expect(out).toContain('Начинали переносить: 10 раз (7 человек)');
    expect(out).toContain('Довели до конца: 6');
    expect(out).toContain('Не получилось: 2');
    expect(out).toContain('Начали и пропали по дороге: 2');
  });

  it('подтвердили под тем же аккаунтом — видно, что переносить было нечего', () => {
    const out = formatAccountLinkMetrics({
      started30: 3,
      startedUsers30: 3,
      confirmed30: 3,
      merged30: 1,
      failed30: 0,
    });

    expect(out).toContain('Из них с реальным переносом данных: 1');
  });

  it('все довели до конца — лишних строк не появляется', () => {
    const out = formatAccountLinkMetrics({
      started30: 4,
      startedUsers30: 4,
      confirmed30: 4,
      merged30: 4,
      failed30: 0,
    });

    expect(out).not.toContain('Не получилось');
    expect(out).not.toContain('пропали по дороге');
    expect(out).not.toContain('реальным переносом');
  });

  it.each([
    [1, '1 человек'],
    [2, '2 человека'],
    [5, '5 человек'],
    [11, '11 человек'],
    [21, '21 человек'],
    [22, '22 человека'],
  ])('склоняет «человек» по числу: %i', (users, expected) => {
    const out = formatAccountLinkMetrics({
      started30: users,
      startedUsers30: users,
      confirmed30: 0,
      merged30: 0,
      failed30: 0,
    });

    expect(out).toContain(`(${expected})`);
  });

  it('подтверждений больше, чем начатых (событие потерялось) — отрицательных чисел не показывает', () => {
    const out = formatAccountLinkMetrics({
      started30: 1,
      startedUsers30: 1,
      confirmed30: 3,
      merged30: 3,
      failed30: 0,
    });

    expect(out).not.toContain('-');
    expect(out).not.toContain('пропали по дороге');
  });
});
