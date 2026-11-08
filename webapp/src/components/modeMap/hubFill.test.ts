import { describe, it, expect } from 'vitest';
import { expandDraft, hubNeedNodes, missingHubNeeds } from './hubFill';
import { nodesInsideHub, HUB_DIAMETER } from './hubGeometry';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';

// Аудит холста 2026-11: «Круг потребностей» из палитры приезжал пустым кругом,
// и заполнить его, как в автоматической схеме случая, было нечем.

const measured = { width: 112, height: 36 }; // таблетка круга 340 после замера

describe('hubNeedNodes', () => {
  it('пять таблеток в порядке NEED_ORDER, все внутри круга — едут вместе с ним', () => {
    const hub = { id: 'h', type: 'needs', position: { x: 100, y: 50 }, data: { diameter: HUB_DIAMETER } };
    const needs = hubNeedNodes('h', hub.position, HUB_DIAMETER, new Set(), 1);
    expect(needs.map((n) => n.data.needId)).toEqual(NEED_ORDER);
    expect(new Set(needs.map((n) => n.id)).size).toBe(5);
    const inside = nodesInsideHub(hub, needs.map((n) => ({ ...n, measured })));
    expect(inside).toHaveLength(5);
  });

  it('таблетка — как в схеме случая: тип need, название, цвет, мелкий шрифт', () => {
    const [first] = hubNeedNodes('h', { x: 0, y: 0 }, HUB_DIAMETER, new Set(), 1);
    expect(first.type).toBe('need');
    expect(first.data).toEqual(expect.objectContaining({ needId: 'attachment', label: 'Привязанность', fontSize: 'sm' }));
    expect(first.data.customColor).toBeTruthy();
  });

  it('skip: уже стоящие потребности второй раз не ставятся', () => {
    const needs = hubNeedNodes('h', { x: 0, y: 0 }, HUB_DIAMETER, new Set(['attachment', 'play']), 1);
    expect(needs.map((n) => n.data.needId)).toEqual(['autonomy', 'expression', 'limits']);
  });
});

describe('expandDraft', () => {
  it('круг потребностей разворачивается в круг и пять потребностей внутри', () => {
    const nodes = expandDraft({ id: 'needs_1', type: 'needs', data: { label: 'К', diameter: HUB_DIAMETER } }, { x: 10, y: 20 });
    expect(nodes.map((n) => n.type)).toEqual(['needs', 'need', 'need', 'need', 'need', 'need']);
    expect(nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('любая другая фигура — одна нода на месте броска', () => {
    expect(expandDraft({ id: 't', type: 'trigger', data: { label: 'Т' } }, { x: 1, y: 2 }))
      .toEqual([{ id: 't', type: 'trigger', data: { label: 'Т' }, position: { x: 1, y: 2 } }]);
  });
});

describe('missingHubNeeds', () => {
  const hub = { id: 'h', type: 'needs', position: { x: 0, y: 0 }, data: { diameter: HUB_DIAMETER } };

  it('пустой круг (поставлен до заполнения) — не хватает всех пяти', () => {
    expect(missingHubNeeds(hub, [hub])).toEqual(NEED_ORDER);
  });

  it('считает только таблетки внутри круга: потребность снаружи не в счёт', () => {
    const inside = hubNeedNodes('h', hub.position, HUB_DIAMETER, new Set(['limits']), 1).map((n) => ({ ...n, measured }));
    const outside = { id: 'far', type: 'need', position: { x: 2000, y: 0 }, data: { label: 'Границы', needId: 'limits' }, measured };
    expect(missingHubNeeds(hub, [hub, ...inside, outside])).toEqual(['limits']);
  });
});
