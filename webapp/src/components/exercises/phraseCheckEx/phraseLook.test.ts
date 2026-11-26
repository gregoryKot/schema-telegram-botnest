// Вид разбора фразы (b18): бусины — по ответам, без выдуманных; знак вердикта — по самому вердикту,
// без своих порогов (сверка со шкалой buildVerdict на всех 0…9 приметах).
import { describe, it, expect } from 'vitest';
import { beadStates, verdictTone, VERDICT_LOOK } from './phraseLook';
import { PHRASE_MARK_IDS } from '../../../../../shared/src/phraseCheck/criteria';
import { buildVerdict } from '../../../../../shared/src/phraseCheck/verdict';

describe('beadStates', () => {
  it('фраза ещё не разбирается — девять пустых бусин', () => {
    expect(beadStates([], -1)).toEqual(Array(9).fill('todo'));
  });

  it('отвеченные — критик или забота, текущая — кольцом, дальше — пусто', () => {
    const [a, b] = PHRASE_MARK_IDS;
    expect(beadStates([b], 3).slice(0, 5)).toEqual(['care', 'critic', 'care', 'now', 'todo']);
    expect(beadStates([a], 3)[0]).toBe('critic');
  });

  it('после девятой — все отвечены, текущей нет', () => {
    const states = beadStates(PHRASE_MARK_IDS.slice(0, 4), 9);
    expect(states.filter((s) => s === 'critic')).toHaveLength(4);
    expect(states.filter((s) => s === 'care')).toHaveLength(5);
    expect(states).not.toContain('now');
  });
});

describe('verdictTone', () => {
  it('сверка со шкалой вердикта: 0 — забота, все примет с вердиктом «как у всех девяти» — критик, между — смешанный', () => {
    const tones = Array.from({ length: 10 }, (_, n) => verdictTone(buildVerdict(PHRASE_MARK_IDS.slice(0, n))));
    expect(tones[0]).toBe('care');
    expect(tones[9]).toBe('critic');
    tones.forEach((t, n) => {
      const v = buildVerdict(PHRASE_MARK_IDS.slice(0, n));
      expect(t === 'care').toBe(!v.suggestRewrite);
      expect(t === 'critic').toBe(v.title === buildVerdict([...PHRASE_MARK_IDS]).title);
    });
    expect(tones).toContain('mixed');
  });

  it('у смешанного — оба голоса, у крайних — один', () => {
    expect(VERDICT_LOOK.mixed.signs).toEqual(['looming', 'together']);
    expect(VERDICT_LOOK.care.signs).toEqual(['together']);
    expect(VERDICT_LOOK.critic.signs).toEqual(['looming']);
  });
});
