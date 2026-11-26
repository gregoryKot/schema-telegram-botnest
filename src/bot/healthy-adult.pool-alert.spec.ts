import {
  poolAlertText,
  formatPoolStatus,
  POOL_ALERT_THRESHOLDS,
} from './healthy-adult.pool-alert';

const status = (unused: number, enabled = 40) => ({
  enabled,
  unused,
  daysLeft: Math.floor(unused / 2),
});

describe('poolAlertText — предупреждение об остатке пула', () => {
  it('молчит, пока запаса много', () => {
    expect(poolAlertText(status(30))).toBeNull();
  });

  it('срабатывает ровно на порогах', () => {
    for (const n of POOL_ALERT_THRESHOLDS) {
      expect(poolAlertText(status(n))).not.toBeNull();
    }
  });

  it('между порогами молчит — иначе предупреждение приходило бы каждый день', () => {
    for (const n of [15, 13, 7, 5, 3, 1]) {
      expect(poolAlertText(status(n))).toBeNull();
    }
  });

  it('на нуле молчит: канал уже повторяется, предупреждать поздно', () => {
    expect(poolAlertText(status(0))).toBeNull();
  });

  it('говорит, сколько осталось и что делать', () => {
    const text = poolAlertText(status(14))!;
    expect(text).toContain('14 из 40');
    expect(text).toContain('7 дн.');
    expect(text).toContain('HEALTHY_ADULT.md');
  });

  it('на последнем пороге не пишет «0 дн.»', () => {
    expect(poolAlertText(status(2))).toContain('меньше чем на день');
  });
});

describe('formatPoolStatus — строка для /stats', () => {
  it('пустая база: честно говорит, что публиковать нечего, без нулей и NaN', () => {
    const text = formatPoolStatus({ enabled: 0, unused: 0, daysLeft: 0 });
    expect(text).toContain('Фраз нет совсем');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('запас есть — показывает остаток и на сколько хватит', () => {
    const text = formatPoolStatus(status(20));
    expect(text).toContain('20 из 40');
    expect(text).toContain('10 дн.');
  });

  it('фразы есть, но все звучали — сообщает про повторы', () => {
    const text = formatPoolStatus({ enabled: 12, unused: 0, daysLeft: 0 });
    expect(text).toContain('повторяет');
    expect(text).not.toMatch(/NaN|undefined/);
  });
});
