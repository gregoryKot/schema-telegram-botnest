// Регрессия инцидента 2026-07-29: публикация в канал падала, пост не
// записывался — и крон честно пробовал снова каждые 5 минут все два часа окна,
// отправляя админу по DM на каждую попытку.
import { SlotAttempts } from './healthy-adult.attempts';

describe('SlotAttempts', () => {
  it('первые попытки разрешены, после лимита — нет', () => {
    const a = new SlotAttempts(3);
    expect(a.allow('d:morning')).toBe(true);
    a.fail('d:morning');
    a.fail('d:morning');
    expect(a.allow('d:morning')).toBe(true);
    a.fail('d:morning');
    expect(a.allow('d:morning')).toBe(false);
  });

  it('exhausted взводится ровно один раз — столько же будет DM админу', () => {
    const a = new SlotAttempts(3);
    const flags = [1, 2, 3].map(() => a.fail('d:morning').exhausted);
    expect(flags).toEqual([false, false, true]);
  });

  it('вечерний слот не тратит попытки утреннего', () => {
    const a = new SlotAttempts(3);
    a.fail('d:morning');
    a.fail('d:morning');
    a.fail('d:morning');
    expect(a.allow('d:morning')).toBe(false);
    expect(a.allow('d:evening')).toBe(true);
  });

  it('успех обнуляет счётчик — завтра снова три попытки', () => {
    const a = new SlotAttempts(3);
    a.fail('d:morning');
    a.reset('d:morning');
    expect(a.allow('d:morning')).toBe(true);
    expect(a.fail('d:morning').attempt).toBe(1);
  });

  it('карта не растёт бесконечно — старые слоты вычищаются', () => {
    const a = new SlotAttempts(3, 4);
    for (let i = 0; i < 20; i++) a.fail(`day-${i}:morning`);
    expect(a.allow('day-0:morning')).toBe(true);
  });
});
