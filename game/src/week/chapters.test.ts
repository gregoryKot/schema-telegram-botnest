import { describe, expect, it, vi } from 'vitest';

// constants.ts смотрит на window (тач или нет) — в node его нет
vi.hoisted(() => vi.stubGlobal('window', {}));
import { PHYS } from '../constants';
import { M } from '../i18n/messages';
import { OPENS, peakX, type Chapter } from './chapter';
import { CHAPTERS, chapterFromHash, nextChapter } from './chapters';
import { secondsTo } from './run';
import { agree, jumpFactor, newWeekState, scroll } from './habits';

const jumpH = (factor: number) => (PHYS.jumpVel * factor) ** 2 / (2 * PHYS.gravity);
const keys = (ch: Chapter) => [ch.title, ch.about, ch.again, ch.who, ch.goal, ch.targetTag, ch.agreeThanks, ch.end.line, ch.end.after,
  ...(ch.pause.between ? [ch.pause.between] : []), ...(ch.pause.named ? [ch.pause.named] : []), ...(ch.invite ? [ch.invite] : []), ...(ch.pause.slips ?? []).flatMap(s => [s.tag, s.thought]), ...Object.values(ch.hints ?? {}), ...Object.values(ch.costs ?? {}),
  ...ch.pause.steps.flatMap(s => [s.question, ...s.options, ...(s.kicker ? [s.kicker] : [])]),
  ...ch.beats.flatMap(b => [...(b.say ? [b.say] : []), ...(b.notifs ?? []), ...(b.goal ? [b.goal] : [])])];

describe.each(CHAPTERS.map(ch => [ch.id, ch] as const))('глава %s — данные', (_id, ch) => {
  it('преграда, которую не перепрыгнуть, встаёт только после кнопки своей привычки', () => {
    for (const g of ch.gates.filter(g => g.kind !== 'pile' || g.h >= jumpH(1))) {
      const beat = ch.beats.find(b => b.reveal === OPENS[g.kind]);
      expect(beat, `${g.kind} @${g.x}`).toBeDefined();
      expect(beat!.x).toBeLessThan(g.x);
    }
  });
  it('ПАУЗА появляется только на пике, после всех преград', () => {
    expect(ch.beats.some(b => b.reveal === 'pause')).toBe(false);
    expect(peakX(ch)).toBeGreaterThan(Math.max(...ch.gates.map(g => g.x)));
  });
  it('спокойное начало шагом, сбой — бегом, в первые полминуты; пик — после полутора минут (в пустой главе — трусцой и вдвое раньше)', () => {
    const glitchAt = ch.beats.find(b => b.glitch)!;
    expect(ch.startPace).toBe('walk');
    expect(glitchAt.pace).toBe(ch.hollow ? 'jog' : 'run');
    const at = (x: number) => secondsTo(ch.startX, ch.startPace, ch.beats, x);
    expect(at(glitchAt.x)).toBeLessThan(30);
    expect(at(peakX(ch))).toBeGreaterThan(ch.hollow ? 30 : 80); // бежать по пустоте полторы минуты незачем
    expect(at(peakX(ch))).toBeLessThan(ch.hollow ? 80 : 150);
  });
  it('места по порядку, часы не идут назад и не выше потолка, строки есть в каталоге', () => {
    const xs = ch.beats.map(b => b.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const clocks = [ch.startClock, ...ch.beats.flatMap(b => (b.clock ? [b.clock] : []))];
    expect([...clocks].sort((a, b) => a - b)).toEqual(clocks);
    expect(Math.max(...clocks)).toBeLessThanOrEqual(ch.clockCap);
    for (const k of keys(ch)) expect(M[k], k).toBeDefined();
  });
  it('у каждого шага ПАУЗЫ верный ответ среди вариантов; у нескольких шагов — подписи шагов и мысль между ними', () => {
    for (const s of ch.pause.steps) expect(s.options[s.correct]).toBeDefined();
    if (ch.pause.steps.length > 1) {
      expect(ch.pause.between).toBeDefined();
      for (const s of ch.pause.steps) expect(s.kicker).toBeDefined();
    }
  });
  it('цель видна из кадра телефона и после названия стоит ближе, чем держалась', () => {
    expect(ch.door.keepAway).toBeLessThan(640 * 0.7);
    expect(ch.door.nearSteps).toBeLessThan(ch.door.keepAway);
    expect(ch.door.x).toBeGreaterThan(ch.startX);
  });
  it('стопка сразу после согласия — только рывком: с рюкзаком не перепрыгнуть (в пустой главе соглашаться не с кем)', () => {
    if (ch.hollow) return void expect(ch.gates).toHaveLength(0);
    const personX = ch.gates.find(p => p.kind === 'person')!.x;
    const next = ch.gates.find(g => g.kind === 'pile' && g.x > personX)!;
    expect(next.h).toBeLessThan(jumpH(1));
    expect(next.h).toBeGreaterThan(jumpH(jumpFactor(agree(newWeekState(0), true))));
  });
});

describe('порядок глав', () => {
  it('хук ведёт в среду, среда — в пятницу, пятница — в воскресенье, у воскресенья продолжения пока нет', () => {
    expect(nextChapter(CHAPTERS[0])?.id).toBe('wed');
    expect(nextChapter(CHAPTERS[1])?.id).toBe('fri');
    expect(nextChapter(CHAPTERS[1])?.invite).toBe('m_wk_fri_invite');
    expect(nextChapter(CHAPTERS[2])?.id).toBe('sun');
    expect(nextChapter(CHAPTERS[2])?.invite).toBe('m_wk_sun_invite');
    expect(nextChapter(CHAPTERS[3])).toBeUndefined();
  });
  it('хеш открывает среду, остальное — хук', () => {
    expect(chapterFromHash('#wed').id).toBe('wed');
    expect(chapterFromHash('#fri').id).toBe('fri');
    expect(chapterFromHash('#sun').id).toBe('sun');
    expect(chapterFromHash('#week').id).toBe('mon');
    expect(chapterFromHash('').id).toBe('mon');
  });
  it('у среды ПАУЗА в два шага: назвать, затем что нужно', () => {
    expect(CHAPTERS[1].pause.steps).toHaveLength(2);
  });
  it('в пятнице ПАУЗА срывается, и каждая следующая попытка держится дольше; раньше срывов нет', () => {
    const ms = CHAPTERS[2].pause.slips!.map(s => s.ms);
    expect(ms.length).toBeGreaterThan(0);
    expect([...ms].sort((a, b) => a - b)).toEqual(ms);
    expect(new Set(ms).size).toBe(ms.length);
    expect(CHAPTERS[0].pause.slips ?? []).toHaveLength(0);
    expect(CHAPTERS[1].pause.slips ?? []).toHaveLength(0);
  });
  it('в воскресенье привычкам не за что зацепиться: преград нет, у каждой привычки строка «почему», кризисная строка на экране', () => {
    const sun = CHAPTERS[3];
    expect(sun.hollow && sun.crisis).toBe(true);
    expect(sun.gates).toHaveLength(0);
    for (const act of ['overwork', 'scroll', 'agree'] as const) {
      expect(sun.costs?.[act], act).toBeDefined();
      expect(sun.beats.some(b => b.reveal === act), act).toBe(true);
    }
    expect(CHAPTERS.filter(c => c.hollow || c.crisis).map(c => c.id)).toEqual(['sun']);
  });
  it('в пятнице первой открывается ПРОЛИСТАТЬ, и два ухода в телефон съедают вечер до пика', () => {
    const fri = CHAPTERS[2];
    expect(fri.beats.find(b => b.reveal)?.reveal).toBe('scroll');
    let st = newWeekState(fri.startClock);
    st = scroll(scroll(st, false, fri.clockCap), false, fri.clockCap);
    expect(st.clockMin).toBe(fri.clockCap);
  });
});
