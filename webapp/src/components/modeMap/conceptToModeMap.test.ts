// conceptToModeMap — схема случая → нода и рёбра карты режимов. Проверяем
// результат (типы, тексты, цвета, направление стрелок, слияние), а не вызовы:
// конвертер чистый, раскладка у него настоящая.
import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from '../../../../shared/src/therapy/conceptGraph/conceptGraphModel';
import { layoutConceptDiagram } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramLayout';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import { needColor } from '../../../../shared/src/needs/needColors';
import { RICH, source } from '../../../../shared/src/therapy/conceptGraph/diagram/diagram.test-helpers';
import type { ConceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import type { ModeMapEdge, ModeMapNode } from '../../api';
import { getSchemaById } from '../../schemaTherapyData';
import { conceptToModeMap } from './conceptToModeMap';

const graphOf = (patch: Partial<ConceptGraphSource>) => buildConceptGraph(source(patch), (ty) => ty);
const RICH_GRAPH = graphOf(RICH);
const byType = (nodes: ModeMapNode[], type: string) => nodes.filter((n) => n.type === type);
const byId = (nodes: ModeMapNode[]) => new Map(nodes.map((n) => [n.id, n]));
const kindOf = (e: ModeMapEdge) => e.id.split('_')[1];
const edgesOf = (edges: ModeMapEdge[], kind: string) => edges.filter((e) => kindOf(e) === kind);

describe('conceptToModeMap — пустая концептуализация', () => {
  const { nodes, edges } = conceptToModeMap(graphOf({}), [], 1);

  it('даёт круг потребностей и пять потребностей, ни одного ребра', () => {
    expect(byType(nodes, 'needs')).toHaveLength(1);
    expect(byType(nodes, 'need').map((n) => n.data.needId)).toEqual(NEED_ORDER);
    expect(byType(nodes, 'need')).toHaveLength(5);
    expect(nodes).toHaveLength(6);
    expect(edges).toEqual([]);
  });

  it('заготовки пустых секций («Режим не отмечен») на карту не попадают', () => {
    expect(nodes.some((n) => n.data.label.includes('не отмечен'))).toBe(false);
  });

  it('круг: диаметр и верхний левый угол берутся из круга раскладки', () => {
    const { cx, cy, r, title } = layoutConceptDiagram(graphOf({}), 1400).circle;
    const hub = byType(nodes, 'needs')[0];
    expect(hub.data.diameter).toBe(2 * r);
    expect(hub.data.label).toBe(title);
    expect(hub.position).toEqual({ x: cx - r, y: cy - r });
  });

  it('потребности — таблетки с needId, цветом потребности и мелким шрифтом (стоят в круге плотно)', () => {
    for (const n of byType(nodes, 'need')) {
      expect(n.data.customColor).toBe(needColor(n.data.needId!));
      expect(n.data.fontSize).toBe('sm');
      expect(n.data.label.length).toBeGreaterThan(0);
    }
  });
});

describe('conceptToModeMap — богатый случай', () => {
  const { nodes, edges } = conceptToModeMap(RICH_GRAPH, [], 7);
  const find = (modeId: string) => nodes.find((n) => n.data.modeId === modeId)!;

  it('режимы получают тип по группе, текст «что говорит» в заметке и display full', () => {
    expect(find('guilt_critic').type).toBe('critic');
    expect(find('vulnerable_child').type).toBe('child');
    expect(find('healthy_adult').type).toBe('healthy');
    const cope = find('detached_protector');
    expect(cope.type).toBe('coping');
    expect(cope.data.copingSubtype).toBe('avoid');
    expect(cope.data.label).toBe('Глиняная оболочка');
    expect(cope.data.note).toBe('Перестаёт чувствовать, говорит на отстранённые темы');
    expect(cope.data.display).toBe('full');
  });

  it('режим без текста не получает пустую заметку', () => {
    expect(find('vulnerable_child').data).not.toHaveProperty('note');
  });

  it('схема: название, убеждение, schemaId и цвет домена', () => {
    const s = nodes.find((n) => n.type === 'schema' && n.data.schemaId === 'emotional_deprivation')!;
    expect(s.data.label).toContain(getSchemaById('emotional_deprivation')!.name);
    expect(s.data.note).toBe('Я верю, что мои переживания не имеют смысла');
    expect(s.data.customColor).toMatch(/^var\(--/);
  });

  it('опыт: подпись «Как нарушалась потребность», текст в заметке, schemaId своей схемы', () => {
    const o = nodes.find((n) => n.type === 'origin' && n.data.schemaId === 'emotional_inhibition')!;
    expect(o.data.label).toBe('Как нарушалась потребность');
    expect(o.data.note).toBe('Видел, как папа бьёт брата за то, что тот не молчал');
  });

  it('позиции совпадают с автоматической раскладкой ширины 1400', () => {
    const layout = layoutConceptDiagram(RICH_GRAPH, 1400);
    const d = layout.nodes.find((x) => x.id === 'schema:emotional_deprivation')!;
    const s = nodes.find((n) => n.type === 'schema' && n.data.schemaId === 'emotional_deprivation')!;
    expect(s.position).toEqual({ x: d.x, y: d.y });
  });

  it('число рёбер по видам: режим⇄схема 4, опыт→схема 2, ✗ 4, ✓ 3', () => {
    expect(edgesOf(edges, 'link')).toHaveLength(4);
    expect(edgesOf(edges, 'origin')).toHaveLength(2);
    expect(edgesOf(edges, 'blocks')).toHaveLength(4);
    expect(edgesOf(edges, 'meets')).toHaveLength(3);
  });

  it('режим ⇄ схема: от режима к схеме, двусторонняя стрелка без подписи', () => {
    const map = byId(nodes);
    for (const e of edgesOf(edges, 'link')) {
      expect(map.get(e.source)!.data.modeId).toBeTruthy();
      expect(map.get(e.target)!.type).toBe('schema');
      expect(e.data).toEqual({ bidirectional: true });
      expect(e.label).toBeUndefined();
    }
  });

  it('опыт → схема: обычная стрелка к той же схеме', () => {
    const map = byId(nodes);
    for (const e of edgesOf(edges, 'origin')) {
      expect(map.get(e.source)!.type).toBe('origin');
      expect(map.get(e.target)!.type).toBe('schema');
      expect(map.get(e.source)!.data.schemaId).toBe(map.get(e.target)!.data.schemaId);
      expect(e.data).toBeUndefined();
    }
  });

  it('✗: от схемы к потребности, красная пунктирная, с подписью ✗', () => {
    const map = byId(nodes);
    const pairs = edgesOf(edges, 'blocks').map((e) => `${map.get(e.source)!.data.schemaId}>${map.get(e.target)!.data.needId}`);
    expect(pairs.sort()).toEqual([
      'emotional_deprivation>attachment',
      'emotional_deprivation>expression',
      'emotional_inhibition>expression',
      'emotional_inhibition>limits',
    ]);
    for (const e of edgesOf(edges, 'blocks')) {
      expect(map.get(e.source)!.type).toBe('schema');
      expect(map.get(e.target)!.type).toBe('need');
      expect(e.label).toBe('✗');
      expect(e.data).toEqual({ color: 'var(--accent-red)', lineStyle: 'dashed' });
    }
  });

  it('✓: от Здорового Взрослого к потребности, зелёная, с подписью ✓', () => {
    const map = byId(nodes);
    const needs = edgesOf(edges, 'meets').map((e) => map.get(e.target)!.data.needId);
    expect(needs.sort()).toEqual(['attachment', 'autonomy', 'play']);
    for (const e of edgesOf(edges, 'meets')) {
      expect(map.get(e.source)!.type).toBe('healthy');
      expect(e.label).toBe('✓');
      expect(e.data).toEqual({ color: 'var(--accent-green)' });
    }
  });

  it('каждое ребро ссылается на существующие ноды, id нод и рёбер уникальны', () => {
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.size).toBe(nodes.length);
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});

describe('conceptToModeMap — id', () => {
  it('имеют вид cc_<вид>_<сущность>_<stamp> и не совпадают между двумя конвертациями', () => {
    const a = conceptToModeMap(RICH_GRAPH, [], 100);
    const b = conceptToModeMap(RICH_GRAPH, [], 200);
    expect(a.nodes.find((n) => n.data.modeId === 'healthy_adult')!.id).toBe('cc_mode_healthy_adult_100');
    const all = [...a.nodes, ...b.nodes].map((n) => n.id);
    expect(new Set(all).size).toBe(all.length);
    const edgeIds = [...a.edges, ...b.edges].map((e) => e.id);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });
});

describe('conceptToModeMap — слияние в непустую карту', () => {
  const first = conceptToModeMap(RICH_GRAPH, [], 1);

  it('повторный прогон по результату первого ничего не дублирует и не добавляет рёбер', () => {
    const again = conceptToModeMap(RICH_GRAPH, first.nodes, 2, first.edges);
    expect(again.nodes).toEqual([]);
    expect(again.edges).toEqual([]);
  });

  it('без списка рёбер ребро между старыми нодами считается отсутствующим и добавляется', () => {
    const again = conceptToModeMap(RICH_GRAPH, first.nodes, 2);
    expect(again.nodes).toEqual([]);
    expect(again.edges).toHaveLength(first.edges.length);
  });

  it('частичное слияние: сдвигаются только новые ноды, рёбра идут к старым id', () => {
    const partial = graphOf({ ...RICH, modeIds: RICH.modeIds!.filter((m) => m !== 'healthy_adult') });
    const old = conceptToModeMap(partial, [], 1);
    const added = conceptToModeMap(RICH_GRAPH, old.nodes, 2, old.edges);

    expect(added.nodes.map((n) => n.data.modeId)).toEqual(['healthy_adult']);
    const right = Math.max(...old.nodes.map((n) => n.position.x + (n.type === 'needs' ? n.data.diameter! : 0)));
    expect(added.nodes[0].position.x).toBe(right + 240);
    // Рёбра ✓ ведут от новой ноды к потребностям, которые уже стоят на карте.
    const oldIds = new Set(old.nodes.map((n) => n.id));
    expect(added.edges).toHaveLength(3);
    for (const e of added.edges) {
      expect(e.source).toBe(added.nodes[0].id);
      expect(oldIds.has(e.target)).toBe(true);
    }
  });

  it('левый край новых нод встаёт ровно на правый край старых + 240, внутренняя раскладка сохраняется', () => {
    const solo: ModeMapNode = { id: 'x', type: 'trigger', position: { x: 1000, y: 50 }, data: { label: 'Триггер' } };
    const out = conceptToModeMap(RICH_GRAPH, [solo], 3);
    const dx = Math.min(...out.nodes.map((n) => n.position.x)) - Math.min(...first.nodes.map((n) => n.position.x));
    expect(Math.min(...out.nodes.map((n) => n.position.x))).toBe(1000 + 240);
    const a = out.nodes.find((n) => n.data.modeId === 'guilt_critic')!;
    const b = first.nodes.find((n) => n.data.modeId === 'guilt_critic')!;
    expect(a.position).toEqual({ x: b.position.x + dx, y: b.position.y });
  });

  it('свой режим пользователя с тем же modeId не дублируется, даже если тип другой', () => {
    const mine: ModeMapNode = { id: 'mine', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Мой ребёнок', modeId: 'vulnerable_child' } };
    const out = conceptToModeMap(RICH_GRAPH, [mine], 4);
    expect(out.nodes.some((n) => n.data.modeId === 'vulnerable_child')).toBe(false);
  });

  it('обычный режим со связанной схемой — не схема: настоящая схема всё равно создаётся', () => {
    const critic: ModeMapNode = { id: 'c', type: 'critic', position: { x: 0, y: 0 }, data: { label: 'Критик', schemaId: 'emotional_deprivation' } };
    const out = conceptToModeMap(RICH_GRAPH, [critic], 5);
    expect(out.nodes.some((n) => n.type === 'schema' && n.data.schemaId === 'emotional_deprivation')).toBe(true);
  });

  it('ребро в обратную сторону для двусторонней связи считается существующим', () => {
    const linkEdge = first.edges.find((e) => kindOf(e) === 'link')!;
    const flipped: ModeMapEdge = { ...linkEdge, source: linkEdge.target, target: linkEdge.source };
    const rest = first.edges.filter((e) => e !== linkEdge);
    const out = conceptToModeMap(RICH_GRAPH, first.nodes, 6, [...rest, flipped]);
    expect(out.edges).toEqual([]);
  });
});
