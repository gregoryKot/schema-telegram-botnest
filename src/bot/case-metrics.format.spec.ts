// Форматтер блока «Разбор случая» для /stats.
//
// Пустая БД проверяется обязательно (правило №8): на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — только честное «пока никто не начинал».
// Отдельно закреплён индикатор Барнума: подсказка про «описания подходят
// всем подряд» обязана появляться, иначе кнопка «у меня было иначе»
// превращается в декорацию.
import { formatCaseMetrics, CaseMetrics } from './case-metrics.format';

const EMPTY: CaseMetrics = {
  started: 0,
  finished: 0,
  sceneOwn: 0,
  sceneFrame: 0,
  verdictMode: 0,
  verdictOrdinary: 0,
  verdictBorderline: 0,
  recognizedAgreed: 0,
  recognizedDoubted: 0,
  namedOwn: 0,
  namedChip: 0,
  namedSkipped: 0,
  people: 0,
  peopleReturned: 0,
};

const filled = (over: Partial<CaseMetrics> = {}): CaseMetrics => ({
  ...EMPTY,
  started: 40,
  finished: 31,
  sceneOwn: 25,
  sceneFrame: 15,
  verdictMode: 22,
  verdictOrdinary: 6,
  verdictBorderline: 3,
  recognizedAgreed: 20,
  recognizedDoubted: 11,
  namedOwn: 14,
  namedChip: 9,
  namedSkipped: 8,
  people: 27,
  peopleReturned: 9,
  ...over,
});

describe('formatCaseMetrics', () => {
  it('на пустой БД говорит «пока никто не начинал» и не показывает нулей', () => {
    const out = formatCaseMetrics(EMPTY);
    expect(out).toContain('Пока никто не начинал');
    expect(out).not.toMatch(/NaN|undefined|null/);
    expect(out).not.toContain('Начали 0');
    expect(out.split('\n')).toHaveLength(2);
  });

  it('показывает воронку, сцену, вердикты и людей', () => {
    const out = formatCaseMetrics(filled());
    expect(out).toContain('Начали 40 · дошли до конца 31');
    expect(out).toContain('Своими словами 25 · по готовой рамке 15');
    expect(out).toContain('Похоже на часть 22');
    expect(out).toContain('Разных людей 27');
    expect(out).toMatch(/вернулись за вторым разбором 9 \(33%\)/);
  });

  it('доля «у меня было иначе» считается от увидевших экран узнавания', () => {
    const out = formatCaseMetrics(filled());
    expect(out).toContain('Сказали «у меня было иначе» 11 из 31 (35%)');
  });

  it('предупреждает, когда почти никто не спорит', () => {
    const out = formatCaseMetrics(
      filled({ recognizedAgreed: 49, recognizedDoubted: 1 }),
    );
    expect(out).toContain('описания подходят всем подряд');
  });

  it('на малой выборке не делает выводов о Барнуме', () => {
    const out = formatCaseMetrics(
      filled({ recognizedAgreed: 5, recognizedDoubted: 0 }),
    );
    expect(out).not.toContain('описания подходят всем подряд');
  });

  it('не делит на ноль, когда экран узнавания никто не видел', () => {
    const out = formatCaseMetrics(
      filled({ recognizedAgreed: 0, recognizedDoubted: 0 }),
    );
    expect(out).toContain('Сказали «у меня было иначе» 0 из 0');
    expect(out).not.toMatch(/NaN|Infinity/);
  });

  it('без людей не показывает процент возврата', () => {
    const out = formatCaseMetrics(filled({ people: 0, peopleReturned: 0 }));
    expect(out).toContain('Разных людей 0 · вернулись за вторым разбором 0');
    expect(out).not.toMatch(/NaN|Infinity/);
  });
});
