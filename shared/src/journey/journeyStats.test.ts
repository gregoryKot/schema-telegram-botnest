// Тест journeyStatRows/journeyTotal — с упором на три новых счётчика
// быстрых практик (breathingSessions/groundingSessions/stopSessions).
// Полное покрытие остальных счётчиков — в
// schema-miniapp/src/share/journeyMeta.test.ts (тот же принцип раздельных
// прямых тестов, см. cardKit.test.ts). Пустой аккаунт проверяем отдельно —
// правило CLAUDE.md №8: агрегат не должен показывать мусор на чистой БД.
import { describe, it, expect } from 'vitest';
import { journeyStatRows, journeyTotal } from './journeyStats';
import { EMPTY_JOURNEY_COUNTS as EMPTY } from './journeyCounts.fixture';

describe('journeyStatRows — быстрые практики', () => {
  it('пустой аккаунт: без новых счётчиков строк нет (не 0/NaN, а пусто)', () => {
    expect(journeyStatRows(EMPTY)).toEqual([]);
    expect(journeyTotal(EMPTY)).toBe(0);
  });

  it('ненулевые счётчики практик — попадают в строки с верным эмодзи/подписью', () => {
    const rows = journeyStatRows({
      ...EMPTY,
      breathingSessions: 4,
      groundingSessions: 2,
      stopSessions: 1,
    });
    expect(rows).toEqual([
      { emoji: '🌬', label: 'Дыхательные практики', count: 4 },
      { emoji: '🌍', label: 'Заземление', count: 2 },
      { emoji: '🛑', label: 'Техника «Стоп»', count: 1 },
    ]);
  });

  it('счётчики практик суммируются в общий итог наравне с остальными', () => {
    const counts = {
      ...EMPTY,
      trackerDays: 3,
      breathingSessions: 2,
      groundingSessions: 1,
      stopSessions: 1,
    };
    expect(journeyTotal(counts)).toBe(7);
  });
});
