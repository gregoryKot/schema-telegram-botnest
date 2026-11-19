import { describe, expect, it } from 'vitest';
import { PEAK_BY_MS, REPEAT_MS, STUCK_MS, jumpHeight, needFor, peakDue, pickHint, type GuideIn } from './guide';

const base: GuideIn = { need: 'jump', stuckMs: STUCK_MS, revealed: [], peak: false, sinceHintMs: REPEAT_MS };

const J = jumpHeight(480, 900), J_LOADED = jumpHeight(480 * 0.88, 900);

describe('needFor', () => {
  it('бордюр и низкую стопку перепрыгивают, высокую берёт переработка', () => {
    expect(needFor('block', 60, J)).toBe('jump');
    expect(needFor('pile', 45, J)).toBe('jump');
    expect(needFor('pile', 170, J)).toBe('overwork');
  });
  it('с рюкзаком средняя стопка уже не перепрыгивается', () => {
    expect(needFor('pile', 105, J)).toBe('jump');
    expect(needFor('pile', 105, J_LOADED)).toBe('overwork');
  });
  it('шум — пролистать, человек — согласиться', () => {
    expect(needFor('noise', 260, J)).toBe('scroll');
    expect(needFor('person', 170, J)).toBe('agree');
  });
});

describe('pickHint', () => {
  it('молчит, пока Саша не упёрся или подсказка была недавно', () => {
    expect(pickHint({ ...base, need: null })).toBeNull();
    expect(pickHint({ ...base, stuckMs: STUCK_MS - 1 })).toBeNull();
    expect(pickHint({ ...base, sinceHintMs: REPEAT_MS - 1 })).toBeNull();
  });
  it('упёрся в бордюр — прыжок', () => expect(pickHint(base)).toBe('jump'));
  it('кнопки привычки ещё нет — молчит', () => expect(pickHint({ ...base, need: 'overwork' })).toBeNull());
  it('кнопка есть — подсказывает её', () => expect(pickHint({ ...base, need: 'overwork', revealed: ['overwork'] })).toBe('overwork'));
  it('на пике с ПАУЗОЙ любая преграда ведёт к ней', () => {
    expect(pickHint({ ...base, need: 'overwork', revealed: ['overwork', 'pause'], peak: true })).toBe('pause');
    expect(pickHint({ ...base, need: 'jump', revealed: ['overwork'], peak: true })).toBe('jump');
  });
});

describe('peakDue', () => {
  it('время вышло — пик', () => expect(peakDue(PEAK_BY_MS, 600, 898)).toBe(true));
  it('телефон унёс часы к встрече — пик', () => expect(peakDue(1000, 898, 898)).toBe(true));
  it('иначе — по месту главы', () => expect(peakDue(PEAK_BY_MS - 1, 897, 898)).toBe(false));
});
