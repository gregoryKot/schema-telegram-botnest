import { formatGuideReferenceMetrics } from './guide-reference-metrics.format';
import type { GuideReferenceMetrics } from './guide-reference-metrics.types';

const EMPTY: GuideReferenceMetrics = {
  opens30: 0,
  therapists30: 0,
  modes30: 0,
  schemas30: 0,
  techniques30: 0,
  notes30: 0,
  needs30: 0,
  concerns30: 0,
  phases30: 0,
  tables30: 0,
};

describe('formatGuideReferenceMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatGuideReferenceMetrics(EMPTY);
    expect(text).toContain('📖 <b>Справочник терапевта</b> (за месяц)');
    expect(text).toContain(
      'Пока никто из терапевтов не открывал справочник в меню.',
    );
    expect(text).not.toMatch(/NaN|undefined|\b0 раз|: 0/);
  });

  it('открывали, но листов не читали — так и сказано, без нулей', () => {
    const text = formatGuideReferenceMetrics({
      ...EMPTY,
      opens30: 4,
      therapists30: 2,
    });
    expect(text).toContain('Открывали 4 раз, терапевтов: 2');
    expect(text).toContain('Ни одного листа оттуда пока не открывали');
    expect(text).not.toMatch(/: 0/);
  });

  it('листы — одной строкой, нулевые части не печатаются', () => {
    const text = formatGuideReferenceMetrics({
      ...EMPTY,
      opens30: 9,
      therapists30: 3,
      modes30: 5,
      needs30: 4,
      techniques30: 2,
      notes30: 1,
      concerns30: 2,
      phases30: 3,
    });
    expect(text).toContain(
      'Читали оттуда — режимы: 5, потребности: 4, техники: 2, «Для терапевта»: 1, запросы и расстройства: 2, путь терапии: 3',
    );
    expect(text).not.toContain('схемы');
    expect(text).not.toContain('Пока никто');
    expect(text).not.toContain('таблицу');
  });

  it('таблицу схем открывали — своя строка', () => {
    const text = formatGuideReferenceMetrics({
      ...EMPTY,
      opens30: 3,
      therapists30: 1,
      tables30: 2,
    });
    expect(text).toContain('Общую таблицу схем открывали: 2');
  });
});
