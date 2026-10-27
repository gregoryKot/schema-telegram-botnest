import { describe, it, expect } from 'vitest';
import {
  detectTherapySignal,
  repeatModeEyebrow,
  type TherapySignalInput,
} from './therapySignal';
import type { DayHistory, ModeDiaryEntry } from '../../types';
import { getModeById } from '../../schemaTherapy/schemaTherapyData';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const NEEDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

const day = (date: string, value: number | null): DayHistory => ({
  date,
  ratings:
    value === null ? {} : Object.fromEntries(NEEDS.map((n) => [n, value])),
});

/** n дней подряд, свежие в конце списка: 2026-10-26, 25, ... */
function days(values: Array<number | null>): DayHistory[] {
  return values.map((v, i) =>
    day(`2026-10-${String(26 - i).padStart(2, '0')}`, v),
  );
}

const entry = (
  id: number,
  modeId: string,
  daysAgo: number,
): ModeDiaryEntry => ({
  id,
  modeId,
  situation: 'x',
  createdAt: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
});

function input(over: Partial<TherapySignalInput> = {}): TherapySignalInput {
  return {
    history: days([6, 6, 7, 6, 7]),
    modeEntries: [],
    crisisSeenAt: null,
    dismissedUntil: null,
    now: NOW,
    ...over,
  };
}

describe('detectTherapySignal', () => {
  it('спокойные дни без записей — сигнала нет', () => {
    expect(detectTherapySignal(input())).toBeNull();
  });

  describe('общий гард', () => {
    it('меньше 5 дней с оценками — ничего, даже при кризисе и низком индексе', () => {
      const history = days([2, 2, 2, 2]);
      expect(
        detectTherapySignal(
          input({ history, crisisSeenAt: NOW.toISOString() }),
        ),
      ).toBeNull();
    });

    it('дни без оценок в пять не засчитываются', () => {
      const history = days([2, 2, 2, 2, null, null]);
      expect(detectTherapySignal(input({ history }))).toBeNull();
    });

    it('ровно 5 дней — проходит', () => {
      expect(
        detectTherapySignal(input({ history: days([2, 2, 2, 2, 2]) }))?.trigger,
      ).toBe('low_index');
    });

    it('«Не сейчас» действует до dismissedUntil и истекает', () => {
      const base = { history: days([2, 2, 2, 2, 2]) };
      const future = new Date(NOW.getTime() + 86400000).toISOString();
      const past = new Date(NOW.getTime() - 86400000).toISOString();
      expect(
        detectTherapySignal(input({ ...base, dismissedUntil: future })),
      ).toBeNull();
      expect(
        detectTherapySignal(input({ ...base, dismissedUntil: past }))?.trigger,
      ).toBe('low_index');
      expect(
        detectTherapySignal(input({ ...base, dismissedUntil: 'мусор' }))
          ?.trigger,
      ).toBe('low_index');
    });
  });

  describe('low_index', () => {
    it('индекс ≤ 4 три заполненных дня подряд', () => {
      const s = detectTherapySignal(input({ history: days([4, 3, 2, 8, 8]) }));
      expect(s).toEqual({
        trigger: 'low_index',
        eyebrow: 'Три дня подряд индекс не выше 4',
      });
    });

    it('порядок входа не важен: берутся три самых свежих по дате', () => {
      const history = days([4, 3, 2, 8, 8]).reverse();
      expect(detectTherapySignal(input({ history }))?.trigger).toBe(
        'low_index',
      );
    });

    it('один день выше 4 среди трёх последних — нет', () => {
      expect(
        detectTherapySignal(input({ history: days([3, 5, 3, 3, 3]) })),
      ).toBeNull();
    });

    it('неполный день (оценены не все потребности) пропускается, а не считается', () => {
      const partial: DayHistory = {
        date: '2026-10-27',
        ratings: { attachment: 1 },
      };
      const history = [partial, ...days([3, 3, 3, 8, 8])];
      expect(detectTherapySignal(input({ history }))?.trigger).toBe(
        'low_index',
      );
    });

    it('меньше трёх заполненных дней — нет', () => {
      const history: DayHistory[] = [
        ...days([2, 2]),
        ...[1, 2, 3].map((i) => ({
          date: `2026-10-0${i}`,
          ratings: { attachment: 2 },
        })),
      ];
      expect(detectTherapySignal(input({ history }))).toBeNull();
    });
  });

  describe('repeat_mode', () => {
    it('один режим три раза за две недели', () => {
      const modeEntries = [
        entry(1, 'punitive_critic', 1),
        entry(2, 'punitive_critic', 5),
        entry(3, 'punitive_critic', 9),
      ];
      const modeId = modeEntries[0].modeId;
      const s = detectTherapySignal(input({ modeEntries }));
      expect(s?.trigger).toBe('repeat_mode');
      expect(s?.modeId).toBe(modeId);
      expect(s?.eyebrow).toBe(
        `${getModeById(modeId)?.name} — 3 раза за две недели`,
      );
    });

    it('два раза — мало; записи старше 14 дней не считаются', () => {
      const m = 'punitive_critic';
      expect(
        detectTherapySignal(
          input({ modeEntries: [entry(1, m, 1), entry(2, m, 2)] }),
        ),
      ).toBeNull();
      expect(
        detectTherapySignal(
          input({
            modeEntries: [entry(1, m, 1), entry(2, m, 2), entry(3, m, 15)],
          }),
        ),
      ).toBeNull();
    });

    it('Здоровый Взрослый сколько ни пиши — не сигнал', () => {
      const modeEntries = [1, 2, 3, 4].map((i) => entry(i, 'healthy_adult', i));
      expect(detectTherapySignal(input({ modeEntries }))).toBeNull();
    });

    it('неизвестный режим не ломает расчёт', () => {
      const modeEntries = [1, 2, 3].map((i) => entry(i, 'no_such_mode', i));
      expect(detectTherapySignal(input({ modeEntries }))).toBeNull();
    });

    it('из нескольких повторяющихся побеждает тот, что чаще', () => {
      const a = 'punitive_critic';
      const b = 'vulnerable_child';
      const modeEntries = [
        entry(1, a, 1),
        entry(2, a, 2),
        entry(3, a, 3),
        entry(4, b, 1),
        entry(5, b, 2),
        entry(6, b, 3),
        entry(7, b, 4),
      ];
      const s = detectTherapySignal(input({ modeEntries }));
      expect(s?.modeId).toBe(b);
      expect(s?.eyebrow).toContain('4 раза');
    });
  });

  describe('crisis', () => {
    it('кризисный след за последние 7 дней', () => {
      const crisisSeenAt = new Date(NOW.getTime() - 6 * 86400000).toISOString();
      expect(detectTherapySignal(input({ crisisSeenAt }))).toEqual({
        trigger: 'crisis',
        eyebrow: 'После тяжёлого дня',
      });
    });

    it('старше 7 дней — не сигнал', () => {
      const crisisSeenAt = new Date(NOW.getTime() - 8 * 86400000).toISOString();
      expect(detectTherapySignal(input({ crisisSeenAt }))).toBeNull();
    });
  });

  it('приоритет: crisis → low_index → repeat_mode', () => {
    const all = {
      history: days([2, 2, 2, 2, 2]),
      modeEntries: [1, 2, 3].map((i) => entry(i, 'punitive_critic', i)),
      crisisSeenAt: NOW.toISOString(),
    };
    expect(detectTherapySignal(input(all))?.trigger).toBe('crisis');
    expect(
      detectTherapySignal(input({ ...all, crisisSeenAt: null }))?.trigger,
    ).toBe('low_index');
    expect(
      detectTherapySignal(
        input({ ...all, crisisSeenAt: null, history: days([6, 6, 6, 6, 6]) }),
      )?.trigger,
    ).toBe('repeat_mode');
  });
});

describe('repeatModeEyebrow', () => {
  it('склонение: 3–4 «раза», 5+ «раз»', () => {
    expect(repeatModeEyebrow('Карающий Критик', 3)).toBe(
      'Карающий Критик — 3 раза за две недели',
    );
    expect(repeatModeEyebrow('Карающий Критик', 4)).toBe(
      'Карающий Критик — 4 раза за две недели',
    );
    expect(repeatModeEyebrow('Карающий Критик', 5)).toBe(
      'Карающий Критик — 5 раз за две недели',
    );
    expect(repeatModeEyebrow('Карающий Критик', 12)).toBe(
      'Карающий Критик — 12 раз за две недели',
    );
  });
});
