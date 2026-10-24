// nodesInsideHub — какие ноды круг потребностей берёт с собой при перетаскивании.
import { describe, it, expect } from 'vitest';
import { HUB_DIAMETER, nodesInsideHub } from './hubGeometry';

const node = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, position: { x, y }, measured: { width: 100, height: 40 }, ...extra,
});
const hub = { id: 'hub', type: 'needs', position: { x: 0, y: 0 }, data: { diameter: 200 } };

describe('nodesInsideHub', () => {
  it('берёт ноды, чей центр внутри круга, и не берёт стоящие снаружи', () => {
    const inside = node('in', 50, 80);                  // центр (100, 100) — середина круга
    const outside = node('out', 400, 80);
    expect(nodesInsideHub(hub, [inside, outside]).map((n) => n.id)).toEqual(['in']);
  });

  it('решает центр, а не угол: нода, лежащая углом в круге, но центром снаружи, остаётся', () => {
    const edge = node('edge', 150, 80);                 // левый край внутри (150 < 200), центр (200, 100) на границе
    const beyond = node('beyond', 190, 80);              // центр (240, 100) — уже снаружи
    expect(nodesInsideHub(hub, [edge, beyond]).map((n) => n.id)).toEqual(['edge']);
  });

  it('круглая граница: центр в углу описанного квадрата — снаружи', () => {
    const corner = node('corner', 125, 155);             // центр (175, 175): квадрат содержит, круг нет
    expect(nodesInsideHub(hub, [corner])).toEqual([]);
  });

  it('не возвращает сам круг и другие круги', () => {
    const other = { ...node('other', 50, 80), type: 'needs' };
    expect(nodesInsideHub(hub, [hub, other])).toEqual([]);
  });

  it('диаметр по умолчанию — HUB_DIAMETER, когда в data его нет', () => {
    const plain = { id: 'h', type: 'needs', position: { x: 0, y: 0 }, data: {} };
    const r = HUB_DIAMETER / 2;
    expect(nodesInsideHub(plain, [node('c', r - 50, r - 20)]).map((n) => n.id)).toEqual(['c']);
    expect(nodesInsideHub(plain, [node('f', HUB_DIAMETER, r - 20)])).toEqual([]);
  });

  it('ещё не измеренная нода считается по левому верхнему углу', () => {
    const raw = { id: 'raw', position: { x: 100, y: 100 } };
    expect(nodesInsideHub(hub, [raw]).map((n) => n.id)).toEqual(['raw']);
  });
});
