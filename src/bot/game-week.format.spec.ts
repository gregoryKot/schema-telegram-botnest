import { formatGameMetrics } from './game-metrics.format';
import { formatWeekLines, weekCtaRate } from './game-week.format';
import { tallyGameRows, type GameEventRow } from './game-metrics.tally';
import { emptyWeek, type WeekMetrics } from './game-week.tally';

const row = (r: Partial<GameEventRow> & { name: string }): GameEventRow => ({
  chapter: null,
  place: null,
  src: null,
  target: null,
  c: 1n,
  ...r,
});

const BAD = /NaN|undefined|Infinity|null/;

describe('новая игра «Неделя» в /stats', () => {
  it('пустая база: ни строк, ни процента, общий блок — прежняя строка', () => {
    expect(formatWeekLines(emptyWeek())).toEqual([]);
    expect(weekCtaRate(emptyWeek())).toBeNull();
    const out = formatGameMetrics(tallyGameRows([]));
    expect(out).toBe('🎮 <b>Игра</b>: за 30 дней никто не открывал.');
  });

  it('клики без начавших: процента нет, мусора нет', () => {
    const w: WeekMetrics = { ...emptyWeek(), clicksApp: 2 };
    const out = formatWeekLines(w).join('\n');
    expect(out).not.toMatch(BAD);
    expect(out).not.toContain('%');
  });

  it('воронка с данными; «Среда» и «до конца» скрыты при нулях', () => {
    const w: WeekMetrics = {
      ...emptyWeek(),
      started: 50,
      ctaShown: 35,
      clicksBooking: 4,
      clicksApp: 6,
      shares: 3,
    };
    const out = formatWeekLines(w).join('\n');
    expect(out).toContain(
      'Новая игра «Неделя»: начали 50 · дошли до карточки 35 · нажали «записаться» 4, «в приложение» 6 · поделились 3',
    );
    expect(out).toContain('Нажали зов: 20% от начавших');
    expect(out).not.toContain('Среду');
    expect(out).not.toContain('до конца');
  });

  it('показывает «Среду» и «до конца», когда счётчики ненулевые', () => {
    const out = formatWeekLines({
      ...emptyWeek(),
      started: 10,
      wedStarted: 5,
      wedDone: 4,
      friStarted: 3,
      friDone: 2,
      sunStarted: 2,
      sunDone: 1,
      firstDone: 2,
    }).join('\n');
    expect(out).toContain(
      'пошли в «Среду» 5 · прошли «Среду» 4 · пошли в «Пятницу» 3 · прошли «Пятницу» 2 · пошли в «Воскресенье» 2 · прошли «Воскресенье» 1 · дошли до конца 2',
    );
  });

  it('tally: новые места и главы идут в «Неделю», не в старую воронку', () => {
    const m = tallyGameRows([
      row({ name: 'game_chapter_start', chapter: 'mon', c: 10n }),
      row({ name: 'game_chapter_done', chapter: 'mon', c: 8n }),
      row({ name: 'game_cta_shown', place: 'hook', c: 7n }),
      row({ name: 'game_cta_click', place: 'hook', target: 'booking', c: 2n }),
      row({ name: 'game_cta_click', place: 'hook', target: 'app', c: 1n }),
      row({ name: 'game_share', place: 'hook', c: 1n }),
      row({ name: 'game_chapter_start', chapter: 'wed', c: 3n }),
      row({ name: 'game_chapter_done', chapter: 'wed', c: 2n }),
      row({ name: 'game_chapter_start', chapter: 'fri', c: 2n }),
      row({ name: 'game_chapter_done', chapter: 'fri', c: 1n }),
      row({ name: 'game_chapter_start', chapter: 'sun', c: 2n }),
      row({ name: 'game_chapter_done', chapter: 'sun', c: 1n }),
      row({ name: 'game_chapter_done', chapter: 'first', c: 1n }),
      row({ name: 'game_cta_shown', place: 'act1', c: 4n }),
      row({ name: 'game_chapter_start', chapter: 'chapter1', c: 5n }),
    ]);
    expect(m.week).toMatchObject({
      started: 10,
      ctaShown: 7,
      clicksBooking: 2,
      clicksApp: 1,
      shares: 1,
      wedStarted: 3,
      wedDone: 2,
      friStarted: 2,
      friDone: 1,
      sunStarted: 2,
      sunDone: 1,
      firstDone: 1,
    });
    expect(m.ctaShown).toBe(4);
    expect(m.ctaClicks).toBe(0);
    expect(m.chapters[0].started).toBe(5);
    expect(weekCtaRate(m.week)).toBe(30);
  });
});
