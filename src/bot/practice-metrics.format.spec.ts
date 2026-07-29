// Форматтер блока «Быстрые практики «Здесь и сейчас»» в /stats: один блок на
// «запускали» + «прошли до конца», пустая БД без NaN/мусора, у заземления нет
// выдуманного «запускали 0» (нет такого события вовсе).
import {
  formatPracticeMetrics,
  PracticeMetrics,
} from './practice-metrics.format';

const FULL: PracticeMetrics = {
  breathing: { started: 33, completed: 12 },
  grounding: { completed: 8 },
  stop: { started: 21, completed: 9 },
  distinctUsers: 14,
};

const EMPTY: PracticeMetrics = {
  breathing: { started: 0, completed: 0 },
  grounding: { completed: 0 },
  stop: { started: 0, completed: 0 },
  distinctUsers: 0,
};

describe('formatPracticeMetrics', () => {
  it('полные данные: дыхание и «Стоп» — оба числа, заземление — только «прошли до конца»', () => {
    const text = formatPracticeMetrics(FULL);
    expect(text).toContain('Быстрые практики «Здесь и сейчас»');
    expect(text).toContain('Дыхание: запускали 33 · прошли до конца 12');
    expect(text).toContain('Заземление: прошли до конца 8');
    expect(text).toContain('«Стоп»: запускали 21 · прошли до конца 9');
    expect(text).toContain('Разных людей: 14');
    // у заземления нет события старта — не должно появиться «запускали»
    const groundingLine = text
      .split('\n')
      .find((l) => l.startsWith('Заземление'));
    expect(groundingLine).not.toContain('запускали');
    expect(text).not.toMatch(/breathing|grounding|event|started|completed/i);
  });

  it('пустая БД: дружелюбная строка, без NaN и без «0 · »', () => {
    const text = formatPracticeMetrics(EMPTY);
    expect(text).toContain('Пока никто не пробовал');
    expect(text).not.toMatch(/NaN|undefined/);
    expect(text).not.toContain('Дыхание');
  });
});
