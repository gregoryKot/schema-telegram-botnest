// Плитки типа цели / задания (b20): бумага и знак — сущности, куда задание ведёт (ENTITY_LOOK), та же карта, что у
// знака строки TaskSign; соседние плитки в сетке 3 и 2 в ряд — не ближе 40° по кругу оттенков (принцип 2). Трекер
// первым и «Своё» последним оставляют одну пару: на телефоне «Дневник» (персик 45) стоит над «Мне плохо» (роза 25) —
// по вертикали, через зазор, знаки разные (камешки и сердце); без неё пришлось бы ставить розу рядом с глиной 28 или
// уводить трекер с первого места (перебор всех порядков, b20).
import { describe, expect, it } from 'vitest';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { taskEntity } from '../../sections/practice/taskListModel';
import { TASK_OPTIONS } from './taskOptions';

const dist = (a: number, b: number) => { const x = Math.abs(a - b) % 360; return Math.min(x, 360 - x); };

/** Пары соседей в сетке cols: справа и снизу. */
function closeNeighbours(cols: number, hues: number[]): string[] {
  const out: string[] = [];
  hues.forEach((h, i) => {
    const right = i % cols < cols - 1 ? i + 1 : -1;
    for (const j of [right, i + cols]) {
      if (j > 0 && j < hues.length && dist(h, hues[j]) < 40) out.push(`${TASK_OPTIONS[i].type}~${TASK_OPTIONS[j].type}`);
    }
  });
  return out;
}

describe('TASK_OPTIONS — вид из ENTITY_LOOK', () => {
  it('у каждой плитки бумага и знак сущности задания — те же, что рисует TaskSign', () => {
    for (const o of TASK_OPTIONS) {
      const look = ENTITY_LOOK[taskEntity({ type: o.type, text: '' })];
      expect([o.hue, o.sign], o.type).toEqual([look.hue, look.sign]);
    }
  });

  it('упражнения — своим знаком, «Своё задание» — Check', () => {
    const sign = Object.fromEntries(TASK_OPTIONS.map(o => [o.type, o.sign]));
    expect(sign).toMatchObject({
      tracker_streak: 'strokes', schema_intro: 'layers', mode_intro: 'cluster', letter_to_self: 'sheets',
      safe_place: 'haven', diary_streak: 'pebbles', belief_check: 'scales', flashcard: 'heart', custom: 'check',
    });
  });

  it('соседи в сетке 3 в ряд различаются не меньше чем на 40°', () => {
    expect(closeNeighbours(3, TASK_OPTIONS.map(o => o.hue))).toEqual([]);
  });

  it('в сетке 2 в ряд — только известная пара «Дневник» над «Мне плохо»', () => {
    expect(closeNeighbours(2, TASK_OPTIONS.map(o => o.hue))).toEqual(['diary_streak~flashcard']);
  });

  it('трекер — первым (выбран по умолчанию), «Своё задание» — последним', () => {
    expect(TASK_OPTIONS[0].type).toBe('tracker_streak');
    expect(TASK_OPTIONS[TASK_OPTIONS.length - 1].type).toBe('custom');
  });
});
