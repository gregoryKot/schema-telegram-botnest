// Тест «мгновенного aha» (аудит 2026-07, этап 4.2).
import { describe, it, expect } from 'vitest';
import { todayInsightPhrase } from './todayInsight';

const full = (v: Partial<Record<string, number>>) => ({
  attachment: 5,
  autonomy: 5,
  expression: 5,
  play: 5,
  limits: 5,
  ...v,
});

describe('todayInsightPhrase', () => {
  it('контраст: называет опору и слабую потребность с баллами', () => {
    const phrase = todayInsightPhrase(full({ attachment: 9, limits: 2 }));
    expect(phrase).toContain('Привязанность (9/10)');
    expect(phrase).toContain('Границы (2/10)');
  });

  it('ровный высокий день', () => {
    expect(todayInsightPhrase(full({ attachment: 8, autonomy: 8, expression: 8, play: 8, limits: 8 }))).toContain(
      'хорошей зоне',
    );
  });

  it('ровный низкий день — бережная формулировка без баллов-приговора', () => {
    expect(
      todayInsightPhrase(full({ attachment: 3, autonomy: 3, expression: 3, play: 3, limits: 3 })),
    ).toContain('бережнее');
  });

  it('ровный средний день', () => {
    expect(todayInsightPhrase(full({}))).toContain('ровный день');
  });

  it('меньше пяти оценок — null', () => {
    expect(todayInsightPhrase({ attachment: 5 })).toBeNull();
    expect(todayInsightPhrase({})).toBeNull();
  });

  it('нет жёстких ты-форм (нейтральные формулировки)', () => {
    for (const r of [full({ attachment: 9, limits: 2 }), full({}), full({ attachment: 3, autonomy: 3, expression: 3, play: 3, limits: 3 })]) {
      const p = todayInsightPhrase(r)!;
      expect(p).not.toMatch(/(?<![А-Яа-яЁё])[Тт]ы(?![А-Яа-яЁё])/);
    }
  });
});
