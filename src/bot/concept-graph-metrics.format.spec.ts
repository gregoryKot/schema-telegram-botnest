import { formatConceptGraphMetrics } from './concept-graph-metrics.format';

describe('formatConceptGraphMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatConceptGraphMetrics({
      opens30: 0,
      therapists30: 0,
      linked30: 0,
    });
    expect(text).toContain('🧩 <b>Графическая концептуализация</b> (за месяц)');
    expect(text).toContain(
      'Пока никто из терапевтов не открывал схему случая по режимам.',
    );
    expect(text).not.toMatch(/NaN|undefined|null|\b0\b/);
  });

  it('заполненная БД — открытия, терапевты и заполненные связи', () => {
    const text = formatConceptGraphMetrics({
      opens30: 14,
      therapists30: 3,
      linked30: 9,
    });
    expect(text).toContain('Открывали 14 раз, терапевтов: 3');
    expect(text).toContain('Связи режимов заполняли 9 раз');
    expect(text).not.toContain('Пока никто');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('открывали, но связи не заполняли — это сказано словами, без «0 раз»', () => {
    const text = formatConceptGraphMetrics({
      opens30: 5,
      therapists30: 2,
      linked30: 0,
    });
    expect(text).toContain('Открывали 5 раз, терапевтов: 2');
    expect(text).toContain('Связи режимов пока не заполняли');
    expect(text).not.toContain('заполняли 0');
  });

  it('связи заполняли, а открытий в окне нет — блок не пустой и не теряет связи', () => {
    const text = formatConceptGraphMetrics({
      opens30: 0,
      therapists30: 0,
      linked30: 2,
    });
    expect(text).not.toContain('Пока никто');
    expect(text).toContain('Связи режимов заполняли 2 раз');
  });
});
