// «Мгновенный aha» после заполнения трекера. Пусто/неполный трекер не
// должен придумывать интерпретацию (правило «никаких заглушек» — меньше
// пяти оценок = нет данных), а формулировки нейтральны по обращению.
import { describe, it, expect } from 'vitest';
import { todayInsightPhrase } from './todayInsight';

const full = (
  v: Partial<Record<string, number>> = {},
): Record<string, number> => ({
  attachment: 5,
  autonomy: 5,
  expression: 5,
  play: 5,
  limits: 5,
  ...v,
});

describe('todayInsightPhrase — неполный трекер', () => {
  it('меньше пяти числовых оценок — null, а не «додуманная» фраза', () => {
    expect(todayInsightPhrase({ attachment: 5 })).toBeNull();
    expect(todayInsightPhrase({})).toBeNull();
  });

  it('null/undefined значения не считаются заполненными оценками', () => {
    expect(
      todayInsightPhrase({ ...full(), attachment: null, autonomy: undefined }),
    ).toBeNull();
  });
});

describe('todayInsightPhrase — контраст между слабой и сильной потребностью', () => {
  it('называет и опору (максимум), и то, что просит внимания (минимум), с баллами', () => {
    const phrase = todayInsightPhrase(full({ attachment: 9, limits: 2 }));
    expect(phrase).toContain('Привязанность (9/10)');
    expect(phrase).toContain('Границы (2/10)');
  });

  it('разница ровно 2 (граница «уже не ровный профиль») — идёт по ветке контраста', () => {
    const phrase = todayInsightPhrase(full({ attachment: 7, limits: 5 }));
    expect(phrase).toContain('опора');
  });
});

describe('todayInsightPhrase — ровный профиль (разница ≤1)', () => {
  it('ровный высокий (avg >= 7) — формулировка про хорошую зону', () => {
    const ratings = {
      attachment: 8,
      autonomy: 8,
      expression: 8,
      play: 8,
      limits: 8,
    };
    expect(todayInsightPhrase(ratings)).toContain('хорошей зоне');
  });

  it('ровный низкий (avg <= 4) — бережная формулировка без чисел-приговора', () => {
    const phrase = todayInsightPhrase(
      full({ attachment: 4, autonomy: 4, expression: 4, play: 4, limits: 4 }),
    );
    expect(phrase).toContain('бережнее');
  });

  it('ровный средний (между 4 и 7) — нейтральная формулировка со средним', () => {
    expect(todayInsightPhrase(full())).toContain('ровный день');
  });
});

describe('todayInsightPhrase — нейтральность по форме обращения', () => {
  it('ни одна ветка не содержит «ты»-форм (нейтральные формулировки без вилки)', () => {
    const cases = [
      full({ attachment: 9, limits: 2 }),
      { attachment: 8, autonomy: 8, expression: 8, play: 8, limits: 8 },
      full({ attachment: 4, autonomy: 4, expression: 4, play: 4, limits: 4 }),
      full(),
    ];
    for (const ratings of cases) {
      const phrase = todayInsightPhrase(ratings)!;
      expect(phrase).not.toMatch(/(?<![А-Яа-яЁё])[Тт]ы(?![А-Яа-яЁё])/);
    }
  });
});
