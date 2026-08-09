// Форматтер блока «Вход в мессенджере» для /stats. Пустое состояние проверяем
// обязательно (правило №8): на чистой БД отчёт не должен пугать нулями и
// «NaN», а на живой аварии — обязан говорить прямо.
import { formatAuthHealth } from './auth-health-metrics.format';

const metrics = (
  day: [number, number],
  week: [number, number],
): Parameters<typeof formatAuthHealth>[0] => ({
  day: { telegram: day[0], max: day[1] },
  week: { telegram: week[0], max: week[1] },
});

describe('formatAuthHealth', () => {
  it('чистая БД — спокойная строка, без нулей и мусора', () => {
    const text = formatAuthHealth(metrics([0, 0], [0, 0]));
    expect(text).toContain('За неделю все входы прошли нормально');
    expect(text).not.toMatch(/NaN|undefined|:\s*0/);
  });

  it('авария идёт прямо сейчас — прямо об этом и говорит', () => {
    const text = formatAuthHealth(metrics([412, 0], [900, 0]));
    expect(text).toContain('Telegram: за сутки 412, за неделю 900');
    expect(text).toContain('открой приложение и проверь вход');
  });

  it('площадка без отказов в строки не попадает', () => {
    const text = formatAuthHealth(metrics([0, 5], [0, 5]));
    expect(text).toContain('MAX: за сутки 5, за неделю 5');
    expect(text).not.toContain('Telegram:');
  });

  it('за неделю было, за сутки нет — отчёт замечает, что починено', () => {
    const text = formatAuthHealth(metrics([0, 0], [120, 0]));
    expect(text).toContain('Telegram: за сутки 0, за неделю 120');
    expect(text).toContain('похоже, уже починено');
  });

  it('язык простой: без англицизмов и служебных имён событий', () => {
    const text = formatAuthHealth(metrics([3, 0], [3, 0]));
    expect(text).not.toMatch(/auth_rejected|empty_signature|initData|events?/i);
  });
});
