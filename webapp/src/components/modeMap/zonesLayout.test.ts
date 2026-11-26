// «Зоны» знают фигуры схемы случая: режимы идут по полосам, как раньше, а схемы,
// опыт и круг потребностей с таблетками — одним блоком под нижней полосой.
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { layoutByZones, ZONES_BOTTOM } from './zonesLayout';
import { HUB_DIAMETER } from './hubGeometry';

type FlowNode = Node<Record<string, unknown>>;

const node = (
  id: string, type: string, x: number, y: number,
  extra: Partial<FlowNode> = {},
): FlowNode => ({ id, type, position: { x, y }, data: {}, ...extra });
const measured = (width: number, height: number) => ({ measured: { width, height } });

/** Схема случая в том виде, как её кладёт «Открыть на холсте»: круг 340 с тремя таблетками внутри. */
function caseMap(): FlowNode[] {
  return [
    node('critic', 'critic', 0, 0),
    node('child', 'child', 400, 0),
    node('healthy', 'healthy', 800, 0),
    node('coping', 'coping', 200, 0),
    node('schema', 'schema', -600, 200, measured(260, 180)),
    node('origin', 'origin', -600, 480, measured(260, 100)),
    node('hub', 'needs', 1000, 600, { data: { diameter: 340 }, ...measured(340, 340) }),
    node('n1', 'need', 1100, 700, measured(112, 40)),
    node('n2', 'need', 1180, 780, measured(112, 40)),
    node('n3', 'need', 1120, 860, measured(112, 40)),
  ];
}
const byId = (nodes: FlowNode[]) => Object.fromEntries(nodes.map((n) => [n.id, n]));

describe('layoutByZones: режимы', () => {
  it('режимы по полосам, как раньше (карта с корнями не меняет их места)', () => {
    const out = byId(layoutByZones(caseMap()));
    expect(out.healthy.position.y).toBe(-200 - 35);
    expect(out.coping.position.y).toBe(230 - 35);
    expect(out.critic.position.y).toBe(690 - 35);
    expect(out.child.position.y).toBe(690 - 35);
    // критик и ребёнок делят нижнюю полосу вдвоём: 150 + 60 + 150 = 360, начало -180
    expect(out.critic.position.x).toBe(-180);
    expect(out.child.position.x).toBe(-180 + 150 + 60);
  });

  it('контроль: карта без корней раскладывается ровно как раньше', () => {
    const modes = [
      node('h', 'healthy', 500, 0), node('c', 'coping', 0, 0), node('t', 'trigger', 0, 0),
      node('crit', 'critic', 700, 0), node('kid', 'child', -300, 0),
    ];
    const out = layoutByZones(modes);
    // нижняя полоса: 3 × 150 + 2 × 60 = 570 → начало -285, порядок по исходному x
    expect(out.map((n) => [n.id, n.position])).toEqual([
      ['h', { x: -75, y: -235 }],
      ['c', { x: -75, y: 195 }],
      ['kid', { x: -285, y: 655 }],
      ['t', { x: -75, y: 655 }],
      ['crit', { x: 135, y: 655 }],
    ]);
    expect(out.every((n) => n.position.y <= ZONES_BOTTOM)).toBe(true);
  });
});

describe('layoutByZones: корни схемы случая', () => {
  const before = byId(caseMap());
  const after = byId(layoutByZones(caseMap()));
  const rootIds = ['schema', 'origin', 'hub', 'n1', 'n2', 'n3'];

  it('корни сохраняют взаимные смещения', () => {
    for (const id of rootIds) {
      expect(after[id].position.x - after.hub.position.x).toBe(before[id].position.x - before.hub.position.x);
      expect(after[id].position.y - after.hub.position.y).toBe(before[id].position.y - before.hub.position.y);
    }
  });

  it('блок стоит ниже нижней полосы: верх блока на 980 + 80', () => {
    const tops = rootIds.map((id) => after[id].position.y);
    expect(Math.min(...tops)).toBe(ZONES_BOTTOM + 80);
    // ни одна нода режима не заходит в блок
    for (const id of ['critic', 'child', 'healthy', 'coping']) {
      expect(after[id].position.y + 70).toBeLessThanOrEqual(ZONES_BOTTOM);
    }
  });

  it('блок отцентрирован по x = 0 (по ящику из размеров нод и диаметра круга)', () => {
    const lefts = rootIds.map((id) => after[id].position.x);
    const rights = rootIds.map((id) => after[id].position.x + (id === 'hub' ? 340 : before[id].measured!.width!));
    expect((Math.min(...lefts) + Math.max(...rights)) / 2).toBeCloseTo(0, 6);
  });

  it('потребности остаются внутри круга', () => {
    const hub = after.hub;
    const cx = hub.position.x + 170;
    const cy = hub.position.y + 170;
    for (const id of ['n1', 'n2', 'n3']) {
      const n = after[id];
      const mx = n.position.x + 56;
      const my = n.position.y + 20;
      expect(Math.hypot(mx - cx, my - cy)).toBeLessThanOrEqual(170);
    }
  });

  it('все ноды на месте: ничего не потеряно и не задвоено', () => {
    expect(layoutByZones(caseMap()).map((n) => n.id).sort()).toEqual(caseMap().map((n) => n.id).sort());
  });

  it('не мутирует вход', () => {
    const input = caseMap();
    const snapshot = JSON.stringify(input);
    layoutByZones(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('layoutByZones: размеры блока', () => {
  it('нет измеренного размера: width/height ноды, потом 150×70, у круга — data.diameter', () => {
    const out = byId(layoutByZones([
      node('a', 'schema', 0, 0, { width: 300, height: 200 }),
      node('b', 'origin', 400, 0),
      node('hub', 'needs', 1000, 0, { data: { diameter: 500 } }),
    ]));
    // правый край = круг 1000 + 500 = 1500, левый = 0 → центр 750 едет в 0
    expect(out.a.position.x).toBe(-750);
    expect(out.hub.position.x).toBe(250);
    expect(out.b.position.x).toBe(-350);
  });

  it('круг без diameter берёт диаметр по умолчанию', () => {
    const [hub] = layoutByZones([node('hub', 'needs', 100, 50)]);
    expect(hub.position.x).toBe(-HUB_DIAMETER / 2);
    expect(hub.position.y).toBe(ZONES_BOTTOM + 80);
  });

  it('таблетка вне круга не едет с блоком: она в нижней полосе, как раньше', () => {
    const out = byId(layoutByZones([
      node('hub', 'needs', 1000, 600, { data: { diameter: 340 }, ...measured(340, 340) }),
      node('stray', 'need', 5000, 5000, measured(112, 40)),
    ]));
    expect(out.stray.position.y).toBe(690 - 35);
  });
});
