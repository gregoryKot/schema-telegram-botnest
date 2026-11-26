import { pickWeeklyRepeat } from './weekly-repeat';

const at = new Date('2026-11-20T10:00:00Z');
const mode = (modeId: string) => ({ modeId, createdAt: at });
const rate = (needId: string, date: string, value: number) => ({
  needId,
  date,
  value,
});

describe('pickWeeklyRepeat', () => {
  it('пусто — null', () => {
    expect(pickWeeklyRepeat([], [])).toBeNull();
  });

  it('одна запись режима и одна низкая оценка — не повтор', () => {
    expect(
      pickWeeklyRepeat(
        [mode('punitive_critic')],
        [rate('play', '2026-11-20', 2)],
      ),
    ).toBeNull();
  });

  it('режим два раза — повтор режима', () => {
    expect(pickWeeklyRepeat([mode('a'), mode('b'), mode('a')], [])).toEqual({
      kind: 'mode',
      key: 'a',
      count: 2,
    });
  });

  it('потребность считается по разным дням; 0 и высокие оценки не в счёт', () => {
    const ratings = [
      rate('play', '2026-11-18', 3),
      rate('play', '2026-11-19', 4),
      rate('play', '2026-11-20', 0),
      rate('play', '2026-11-21', 7),
      rate('limits', '2026-11-18', 2),
    ];
    expect(pickWeeklyRepeat([], ratings)).toEqual({
      kind: 'need',
      key: 'play',
      count: 2,
    });
  });

  it('побеждает больший счёт', () => {
    const ratings = [
      rate('play', '2026-11-17', 1),
      rate('play', '2026-11-18', 1),
      rate('play', '2026-11-19', 1),
    ];
    expect(pickWeeklyRepeat([mode('a'), mode('a')], ratings)).toEqual({
      kind: 'need',
      key: 'play',
      count: 3,
    });
  });

  it('ничья — режим', () => {
    const ratings = [
      rate('play', '2026-11-18', 1),
      rate('play', '2026-11-19', 1),
    ];
    expect(pickWeeklyRepeat([mode('a'), mode('a')], ratings)).toEqual({
      kind: 'mode',
      key: 'a',
      count: 2,
    });
  });
});
