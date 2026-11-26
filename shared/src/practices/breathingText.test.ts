// Тексты дыхания 4-4-6: строка во время дыхания собирается из частей полосы фаз — части и
// строка не разъезжаются, а длины отрезков — те же секунды, что у таймера (breathing.ts).
import { describe, it, expect } from 'vitest';
import { BREATH_CYCLE_S, breathStateAt } from './breathing';
import { breathCardText } from './breathingText';
import { BREATH_PHASES } from './breathPhases';

const ty = (t: string) => t;
const vy = (_t: string, v: string) => v;

describe('breathCardText', () => {
  it('во время дыхания: прежняя строка «круг · вдох · задержка · выдох» из частей полосы', () => {
    const t = breathCardText(ty, 'active', breathStateAt(BREATH_CYCLE_S + 5));
    expect(t.title).toBe('Задержка');
    expect(t.cycle).toBe('круг 2 из 4');
    expect(t.lines).toEqual(['круг 2 из 4 · вдох 4 · задержка 4 · выдох 6']);
    expect(t.action).toBe('Достаточно');
  });

  it('фазы полосы — по порядку круга, их секунды складываются в круг', () => {
    expect(BREATH_PHASES.map((p) => p.id)).toEqual(['in', 'hold', 'out']);
    expect(BREATH_PHASES.reduce((s, p) => s + p.seconds, 0)).toBe(
      BREATH_CYCLE_S,
    );
  });

  it('в покое и после — без полосы фаз; обращение в обеих формах', () => {
    const idle = breathCardText(vy, 'idle', breathStateAt(0));
    expect(idle.cycle).toBeUndefined();
    expect(idle.title).toBe('Дышите со мной');
    const done = breathCardText(ty, 'finished', breathStateAt(0));
    expect(done.cycle).toBeUndefined();
    expect(done.action).toBe('Ещё минуту');
  });
});
