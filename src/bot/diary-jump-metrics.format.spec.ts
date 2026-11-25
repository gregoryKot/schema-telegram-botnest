import { formatDiaryJumpMetrics } from './diary-jump-metrics.format';

describe('formatDiaryJumpMetrics', () => {
  it('пустая БД — понятная строка без нулей и NaN', () => {
    const out = formatDiaryJumpMetrics({
      pattern30: 0,
      tracker30: 0,
      case30: 0,
    });
    expect(out).toContain('Пока никто не переходил');
    expect(out).not.toMatch(/NaN|undefined/);
  });

  it('выводит три счётчика простым языком', () => {
    const out = formatDiaryJumpMetrics({
      pattern30: 5,
      tracker30: 2,
      case30: 1,
    });
    expect(out).toContain(
      'К карточке схемы или режима 5, к трекеру 2, к разбору 1',
    );
  });
});
