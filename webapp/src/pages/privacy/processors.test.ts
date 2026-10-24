// Перечень получателей данных: у каждого есть имя, назначение и состав
// данных (политика не должна называть сервис «в никуда»).
import { describe, it, expect } from 'vitest';
import { FOREIGN_PROCESSORS, METRIKA_PROCESSOR, processorLine } from './processors';

describe('processors', () => {
  it('у каждого получателя заполнены имя, назначение и данные', () => {
    for (const p of [...FOREIGN_PROCESSORS, METRIKA_PROCESSOR]) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.data.length).toBeGreaterThan(5);
    }
  });

  it('иностранные интеграции перечислены: Telegram, Google, Resend, iCloud, Zoom', () => {
    const names = FOREIGN_PROCESSORS.map((p) => p.name).join('|');
    for (const n of ['Telegram', 'Google', 'Resend', 'iCloud', 'Zoom']) expect(names).toContain(n);
  });

  it('Метрика не в иностранных — российский сервис', () => {
    expect(FOREIGN_PROCESSORS.some((p) => /Яндекс/.test(p.name))).toBe(false);
  });

  it('processorLine склеивает имя, назначение и данные', () => {
    expect(processorLine({ name: 'A', purpose: 'зачем', data: 'что' })).toBe('A – зачем (что)');
  });
});
