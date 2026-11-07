// Агрегат meta therapy_nudge одним проходом (вместо count на каждое место —
// perf-гейт stats-report, PR #945).
import {
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import { aggregateTherapyNudge } from './therapy-nudge-metrics.aggregate';

describe('aggregateTherapyNudge', () => {
  it('пусто: списки полные, все нули', () => {
    const m = aggregateTherapyNudge([]);
    expect(m.shownByPlace).toHaveLength(THERAPY_NUDGE_PLACES.length);
    expect(m.signalByTrigger).toHaveLength(THERAPY_NUDGE_TRIGGERS.length);
    expect(m.shownByPlace.every((r) => r.count === 0)).toBe(true);
    expect([m.open, m.book, m.write, m.dismiss]).toEqual([0, 0, 0, 0]);
  });

  it('раскладывает по месту, причине и действию; чужое и мусор не считает', () => {
    const m = aggregateTherapyNudge([
      { place: 'home', action: 'shown' },
      { place: 'home', action: 'shown' },
      { place: 'exercise_start', action: 'shown' },
      { place: 'signal_card', action: 'shown', trigger: 'crisis' },
      { place: 'signal_card', action: 'shown', trigger: 'bogus' },
      { place: 'home', action: 'shown', trigger: 'crisis' }, // trigger вне карточки — не причина
      { place: 'nowhere', action: 'shown' },
      { place: 'more', action: 'open' },
      { place: 'more', action: 'book' },
      { place: 'home', action: 'write' },
      { place: 'signal_card', action: 'dismiss', trigger: 'low_index' },
      { place: 'home', action: 'teleport' },
      null,
      'строка',
      42,
    ]);
    const by = (k: string) => m.shownByPlace.find((r) => r.place === k)?.count;
    expect(by('home')).toBe(3);
    expect(by('exercise_start')).toBe(1);
    expect(by('signal_card')).toBe(2);
    expect(by('more')).toBe(0);
    expect(m.signalByTrigger.find((r) => r.trigger === 'crisis')?.count).toBe(
      1,
    );
    expect(m.signalByTrigger.find((r) => r.trigger === 'none')?.count).toBe(0);
    expect([m.open, m.book, m.write, m.dismiss]).toEqual([1, 1, 1, 1]);
  });
});
