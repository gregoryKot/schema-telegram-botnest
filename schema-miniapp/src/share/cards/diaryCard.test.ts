// Тест сводной карточки дневника: выбор самой ранней даты записи.
import { describe, it, expect } from 'vitest';
import { earliestDateLabel } from '../../../../shared/src/share/cards/diaryCard';

describe('earliestDateLabel', () => {
  it('пусто → null', () => {
    expect(earliestDateLabel([])).toBeNull();
  });

  it('находит самую раннюю дату независимо от порядка', () => {
    const label = earliestDateLabel([
      { createdAt: '2026-07-10T12:00:00Z' },
      { createdAt: '2026-05-03T09:00:00Z' },
      { createdAt: '2026-06-20T18:30:00Z' },
    ]);
    expect(label).toMatch(/3\s+мая/);
  });

  it('битая дата → null', () => {
    expect(earliestDateLabel([{ createdAt: 'not-a-date' }])).toBeNull();
  });
});
