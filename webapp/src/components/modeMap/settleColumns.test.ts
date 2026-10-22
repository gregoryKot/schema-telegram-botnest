// settleColumns — «осадка» колонок перенесённой схемы случая по измеренной высоте.
// Чистая функция: проверяем координаты и флаги на настоящих числах.
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { settleColumns } from './settleColumns';
import { toFlowNodes, fromFlowNodes } from '../modeMapFlow';
import type { ModeMapNode } from '../../api';

type FlowNode = Node<Record<string, unknown>>;

const fig = (
  id: string, type: string, x: number, y: number, w: number, h: number,
  data: Record<string, unknown> = { settle: true },
): FlowNode => ({ id, type, position: { x, y }, data, measured: { width: w, height: h } });
const at = (nodes: FlowNode[], id: string) => nodes.find((n) => n.id === id)!;

describe('settleColumns: раздвигает колонку', () => {
  // Колонка схем x 0..250: первая выросла до 400, вторая и третья стояли для 180.
  const input = [
    fig('s1', 'schema', 0, 0, 250, 400),
    fig('s2', 'schema', 0, 200, 250, 180),
    fig('s3', 'schema', 0, 400, 250, 180),
  ];
  const { nodes, changed } = settleColumns(input);

  it('нода, наползавшая на предыдущую, уезжает вниз на gap под неё', () => {
    expect(at(nodes, 's1').position.y).toBe(0);
    expect(at(nodes, 's2').position.y).toBe(400 + 24);
  });

  it('сдвиг накапливается: следующая считается от уже сдвинутой', () => {
    expect(at(nodes, 's3').position.y).toBe(424 + 180 + 24);
  });

  it('x и порядок сохраняются, вход не мутируется', () => {
    expect(nodes.map((n) => [n.id, n.position.x])).toEqual([['s1', 0], ['s2', 0], ['s3', 0]]);
    expect(input[1].position.y).toBe(200);
    expect(input[1].data.settle).toBe(true);
    expect(changed).toBe(true);
  });

  it('свой gap учитывается', () => {
    expect(at(settleColumns(input, 50).nodes, 's2').position.y).toBe(450);
  });

  it('ноды стояли вразнобой по порядку массива — колонка идёт сверху вниз по y', () => {
    const shuffled = [input[2], input[0], input[1]];
    const out = settleColumns(shuffled).nodes;
    expect(at(out, 's2').position.y).toBe(424);
    expect(at(out, 's3').position.y).toBe(628);
    expect(out.map((n) => n.id)).toEqual(['s3', 's1', 's2']);
  });
});

describe('settleColumns: колонки независимы', () => {
  it('соседняя колонка не задета, даже если её фигуры стоят на тех же y', () => {
    const { nodes } = settleColumns([
      fig('a1', 'schema', 0, 0, 250, 400),
      fig('a2', 'schema', 0, 200, 250, 100),
      fig('b1', 'critic', 400, 0, 150, 70),
      fig('b2', 'critic', 400, 200, 150, 70),
    ]);
    expect(at(nodes, 'a2').position.y).toBe(424);
    expect(at(nodes, 'b1').position.y).toBe(0);
    expect(at(nodes, 'b2').position.y).toBe(200);
  });

  it('фигуры, чьи отрезки по x пересекаются хоть чуть-чуть, — одна колонка', () => {
    const { nodes } = settleColumns([
      fig('wide', 'schema', 0, 0, 250, 300),
      fig('shifted', 'origin', 200, 100, 215, 100), // [200, 415] пересекает [0, 250]
    ]);
    expect(at(nodes, 'shifted').position.y).toBe(324);
  });

  it('отрезки впритык (правый край = левому краю соседа) — разные колонки', () => {
    const { nodes } = settleColumns([
      fig('l', 'schema', 0, 0, 250, 300),
      fig('r', 'critic', 250, 100, 150, 70),
    ]);
    expect(at(nodes, 'r').position.y).toBe(100);
  });
});

describe('settleColumns: что не двигается', () => {
  it('круг и таблетки потребностей стоят на месте, но флаг с них снят', () => {
    const { nodes, changed } = settleColumns([
      fig('hub', 'needs', 0, 0, 340, 340),
      fig('n1', 'need', 100, 100, 112, 40),
      fig('n2', 'need', 100, 110, 112, 40), // «наползает» на n1, но у таблеток геометрия фиксированная
    ]);
    expect(nodes.map((n) => n.position)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 110 }]);
    expect(nodes.every((n) => n.data.settle === undefined)).toBe(true);
    expect(changed).toBe(true);
  });

  it('нода без флага не двигается и не мешает чужой колонке', () => {
    const { nodes } = settleColumns([
      fig('mine', 'schema', 0, 0, 250, 400, {}),
      fig('fresh', 'schema', 0, 100, 250, 100),
    ]);
    expect(at(nodes, 'mine').position.y).toBe(0);
    expect(at(nodes, 'fresh').position.y).toBe(100); // старая нода — не препятствие для свежей
  });

  it('нода без замера не двигается, флаг снимается', () => {
    const lone: FlowNode = { id: 'u', type: 'schema', position: { x: 0, y: 5 }, data: { settle: true } };
    const { nodes } = settleColumns([lone, fig('m', 'schema', 0, 0, 250, 400)]);
    expect(at(nodes, 'u').position).toEqual({ x: 0, y: 5 });
    expect(at(nodes, 'u').data.settle).toBeUndefined();
  });
});

describe('settleColumns: ничего не наползает', () => {
  const clean = [
    fig('s1', 'schema', 0, 0, 250, 150),
    fig('s2', 'schema', 0, 200, 250, 150),
    fig('c1', 'critic', 400, 0, 150, 70),
  ];

  it('контроль: позиции те же, флаг снят', () => {
    const { nodes, changed } = settleColumns(clean);
    expect(nodes.map((n) => n.position)).toEqual(clean.map((n) => n.position));
    expect(nodes.every((n) => !('settle' in n.data))).toBe(true);
    expect(changed).toBe(true);
  });

  it('вторая осадка по результату первой ничего не меняет', () => {
    const once = settleColumns([fig('a', 'schema', 0, 0, 250, 400), fig('b', 'schema', 0, 200, 250, 100)]).nodes;
    const twice = settleColumns(once);
    expect(twice.changed).toBe(false);
    expect(twice.nodes).toEqual(once);
  });

  it('без флагов changed = false, а ноды те же объекты', () => {
    const plain = [fig('p', 'schema', 0, 0, 250, 100, {})];
    const out = settleColumns(plain);
    expect(out.changed).toBe(false);
    expect(out.nodes[0]).toBe(plain[0]);
  });

  it('пустой вход', () => {
    expect(settleColumns([])).toEqual({ nodes: [], changed: false });
  });
});

describe('флаг осадки и сохранение карты', () => {
  const saved: ModeMapNode[] = [
    { id: 'a', type: 'schema', position: { x: 0, y: 0 }, data: { label: 'Схема', settle: true } },
  ];

  it('до осадки флаг переживает сохранение и загрузку (карта откроется и осядет)', () => {
    expect(fromFlowNodes(toFlowNodes(saved))[0].data.settle).toBe(true);
  });

  it('после осадки в сохранённой карте флага нет', () => {
    const measured = toFlowNodes(saved).map((n) => ({ ...n, measured: { width: 250, height: 100 } }));
    const stored = fromFlowNodes(settleColumns(measured).nodes);
    expect(stored[0].data).toEqual({ label: 'Схема' });
  });
});
