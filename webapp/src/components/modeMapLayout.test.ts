// modeMapLayout.ts — 0% покрытия (750-строчная дыра ModeMap-семьи). Тестируем
// реальную геометрию (координаты), а не «не упало»: dagre и ручные layout-
// функции детерминированы при фиксированных width/height, так что можно
// сверять точные числа.
import { describe, it, expect } from 'vitest';
import { autoLayout, layoutByZones, layoutCouple } from './modeMapLayout';
import type { Node, Edge } from '@xyflow/react';

type FlowNode = Node<Record<string, unknown>>;
type FlowEdge = Edge<Record<string, unknown>>;

function n(id: string, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'custom', position: { x: 0, y: 0 }, data: {}, ...extra };
}
function e(source: string, target: string): FlowEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('autoLayout', () => {
  it('на пустом графе возвращает пустой массив', () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it('один узел без рёбер уходит в верхний левый угол по margin (40,40)', () => {
    const [out] = autoLayout([n('a')], []);
    // Без width/height и без размера в NODE_DEFAULT_SIZES используется
    // запасной 150×70 → центр в (115,75) минус половина размера = (40,40).
    expect(out.position).toEqual({ x: 40, y: 40 });
  });

  it('связанные узлы выстраиваются вдоль LR-рангов: источник левее цели', () => {
    const [a, b] = autoLayout([n('a'), n('b')], [e('a', 'b')]);
    expect(a.position).toEqual({ x: 40, y: 40 });
    expect(b.position).toEqual({ x: 300, y: 40 });
    expect(a.position.x).toBeLessThan(b.position.x);
  });

  it('явный width/height узла учитывается вместо запасного 150×70', () => {
    const [a, b] = autoLayout(
      [n('a', { width: 100, height: 50 }), n('b', { width: 100, height: 50 })],
      [e('a', 'b')],
    );
    // Центр a: x=40+50=90 (marginx + width/2) → position.x = 90-50=40.
    expect(a.position).toEqual({ x: 40, y: 40 });
    // b на следующем ранге: 40 + 100 + ranksep(110) = 250.
    expect(b.position).toEqual({ x: 250, y: 40 });
  });

  it('цикл (a→b→a) не падает и раскладывает оба узла на разных рангах', () => {
    const out = autoLayout([n('a'), n('b')], [e('a', 'b'), e('b', 'a')]);
    expect(out).toHaveLength(2);
    const [a, b] = out;
    expect(a.position.x).not.toBe(b.position.x);
  });

  it('не мутирует входной массив узлов', () => {
    const input = [n('a'), n('b')];
    const before = input.map(x => ({ ...x.position }));
    autoLayout(input, [e('a', 'b')]);
    expect(input.map(x => x.position)).toEqual(before);
  });
});

describe('layoutByZones', () => {
  it('раскладывает по трём полосам: healthy → 0, coping → 1, остальные → 2', () => {
    const nodes = [n('h', { type: 'healthy' }), n('c', { type: 'coping' }), n('t', { type: 'trigger' })];
    const out = layoutByZones(nodes);
    const byId = Object.fromEntries(out.map(x => [x.id, x]));
    // BAND_CENTER_Y = [-200, 230, 690]; один узел на полосу (150×70 запасной) →
    // y = центр полосы - height/2, x = -width/2 (центрирование одиночного узла).
    expect(byId.h.position).toEqual({ x: -75, y: -200 - 35 });
    expect(byId.c.position).toEqual({ x: -75, y: 230 - 35 });
    expect(byId.t.position).toEqual({ x: -75, y: 690 - 35 });
  });

  it('critic/child/behavior/custom тоже падают в третью (нижнюю) полосу', () => {
    const nodes = [
      n('critic', { type: 'critic' }), n('child', { type: 'child' }),
      n('beh', { type: 'behavior' }), n('custom', { type: 'custom' }),
    ];
    const out = layoutByZones(nodes);
    const ys = new Set(out.map(x => x.position.y));
    expect(ys.size).toBe(1);
    expect([...ys][0]).toBe(690 - 35);
  });

  it('несколько узлов в одной полосе центрируются вокруг x=0 и упорядочены по исходному x', () => {
    // Исходный порядок в массиве обратный тому, как узлы стоят по x —
    // функция обязана пересортировать по позиции, а не сохранить порядок ввода.
    const nodes = [
      n('right', { type: 'healthy', position: { x: 500, y: 0 } }),
      n('left', { type: 'healthy', position: { x: -500, y: 0 } }),
    ];
    const out = layoutByZones(nodes);
    const byId = Object.fromEntries(out.map(x => [x.id, x]));
    // total = 150+150+60(gap) = 360 → начало -180.
    expect(byId.left.position.x).toBe(-180);
    expect(byId.right.position.x).toBe(-180 + 150 + 60);
    expect(byId.left.position.x).toBeLessThan(byId.right.position.x);
  });

  it('на пустом входе возвращает пустой массив', () => {
    expect(layoutByZones([])).toEqual([]);
  });
});

describe('layoutCouple', () => {
  it('раскладывает по трём колонкам: A слева, C(нет side) в центре, B справа', () => {
    const nodes = [
      n('a', { data: { side: 'A' } }),
      n('b', { data: { side: 'B' } }),
      n('c', { data: {} }),
    ];
    const out = layoutCouple(nodes);
    const byId = Object.fromEntries(out.map(x => [x.id, x]));
    expect(byId.a.position.x).toBe(-360);
    expect(byId.c.position.x).toBe(-110);
    expect(byId.b.position.x).toBe(160);
  });

  it('внутри колонки сортирует по клинической роли: trigger → critic → child → coping/custom → behavior → healthy', () => {
    const nodes = [
      n('healthy', { type: 'healthy', data: { side: 'A' } }),
      n('trigger', { type: 'trigger', data: { side: 'A' } }),
      n('child', { type: 'child', data: { side: 'A' } }),
      n('critic', { type: 'critic', data: { side: 'A' } }),
    ];
    const out = layoutCouple(nodes);
    const byId = Object.fromEntries(out.map(x => [x.id, x]));
    // ROLE_RANK: trigger 0, critic 1, child 2, healthy 5 → строки 0..3.
    expect(byId.trigger.position.y).toBe(0);
    expect(byId.critic.position.y).toBe(160);
    expect(byId.child.position.y).toBe(320);
    expect(byId.healthy.position.y).toBe(480);
  });

  it('custom делит ранг с coping (оба ранг 3) и сохраняет относительный порядок ввода при равенстве', () => {
    const nodes = [
      n('custom1', { type: 'custom', data: { side: 'A' } }),
      n('coping1', { type: 'coping', data: { side: 'A' } }),
    ];
    const out = layoutCouple(nodes);
    const byId = Object.fromEntries(out.map(x => [x.id, x]));
    // Array.prototype.sort стабилен: при равном ранге порядок ввода сохраняется.
    expect(byId.custom1.position.y).toBe(0);
    expect(byId.coping1.position.y).toBe(160);
  });

  it('на пустом входе возвращает пустой массив', () => {
    expect(layoutCouple([])).toEqual([]);
  });
});
