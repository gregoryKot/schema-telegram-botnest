// QA 2026-11 (B-З6): пустой день истории показывал «индекс 0.0 ↓ вчера 6.0».
import { describe, it, expect } from 'vitest';
import { wheelCenter } from './wheelCenter';

const IDS = ['attachment', 'autonomy'];

describe('wheelCenter', () => {
  it('пустой день после заполненного — «—», без стрелки падения', () => {
    expect(wheelCenter(IDS, {}, { attachment: 6, autonomy: 6 })).toEqual({
      index: '—',
      prev: 'вчера 6,0',
    });
  });

  it('день заполнен не целиком — индекса нет: недостающая оценка не ноль', () => {
    expect(wheelCenter(IDS, { attachment: 8 }).index).toBe('—');
  });

  it('оценка 0 в истории — «не заполнено», а не ноль в среднем', () => {
    expect(wheelCenter(IDS, { attachment: 8, autonomy: 0 }).index).toBe('—');
    expect(
      wheelCenter(IDS, { attachment: 8, autonomy: 4 }, { attachment: 0 }).prev,
    ).toBeNull();
  });

  it('оба дня заполнены — индекс с запятой и стрелка к вчера', () => {
    expect(
      wheelCenter(
        IDS,
        { attachment: 8, autonomy: 8 },
        { attachment: 4, autonomy: 4 },
      ),
    ).toEqual({
      index: '8,0',
      prev: '↑ вчера 4,0',
    });
    expect(
      wheelCenter(
        IDS,
        { attachment: 2, autonomy: 4 },
        { attachment: 4, autonomy: 4 },
      ).prev,
    ).toBe('↓ вчера 4,0');
    expect(
      wheelCenter(
        IDS,
        { attachment: 4, autonomy: 4 },
        { attachment: 4, autonomy: 4 },
      ).prev,
    ).toBe('вчера 4,0');
  });

  it('вчера пусто — строки «вчера» нет', () => {
    expect(wheelCenter(IDS, { attachment: 5, autonomy: 5 }).prev).toBeNull();
  });
});
