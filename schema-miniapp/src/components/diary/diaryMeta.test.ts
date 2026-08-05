import { describe, it, expect, vi, afterEach } from 'vitest';
import { diaryRowMeta } from './diaryMeta';

// Мета-строка дневника в хабе. Пустое состояние проверяем отдельно и первым:
// на чистом аккаунте здесь не должно появиться ни «0 записей», ни «NaN», ни
// выдуманной даты (правило «никаких хардкод-заглушек»).
describe('diaryRowMeta', () => {
  afterEach(() => vi.useRealTimers());

  it('без записей — «Пока пусто», без нулей и дат', () => {
    expect(diaryRowMeta(0)).toBe('Пока пусто');
    expect(diaryRowMeta(0, '2026-08-01T10:00:00.000Z')).toBe('Пока пусто');
  });

  it('отрицательный счётчик тоже читается как пусто, а не как «-1 записей»', () => {
    expect(diaryRowMeta(-1)).toBe('Пока пусто');
  });

  it('склоняет «запись/записи/записей»', () => {
    expect(diaryRowMeta(1)).toBe('1 запись');
    expect(diaryRowMeta(3)).toBe('3 записи');
    expect(diaryRowMeta(12)).toBe('12 записей');
    expect(diaryRowMeta(21)).toBe('21 запись');
  });

  it('с датой последней записи добавляет, когда это было', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00.000Z'));
    expect(diaryRowMeta(12, '2026-08-04T09:00:00.000Z')).toBe(
      '12 записей · сегодня',
    );
    expect(diaryRowMeta(2, '2026-08-03T09:00:00.000Z')).toBe(
      '2 записи · вчера',
    );
  });
});
