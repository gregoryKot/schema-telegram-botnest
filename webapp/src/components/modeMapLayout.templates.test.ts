// TEMPLATES/templateToGraph — стартовые шаблоны карты режимов. Инвариант
// реестра: индексы from/to в edges обязаны попадать в диапазон nodes, иначе
// templateToGraph упадёт на `nodes[e.from].id` (undefined.id).
import { describe, it, expect, vi } from 'vitest';
import { TEMPLATES, templateToGraph } from './modeMapLayout';

describe('TEMPLATES — инвариант реестра', () => {
  it('id шаблонов уникальны', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('в каждом шаблоне id узлов уникальны', () => {
    for (const tpl of TEMPLATES) {
      const ids = tpl.nodes.map(n => n.id);
      expect(new Set(ids).size, `дубли id в шаблоне ${tpl.id}`).toBe(ids.length);
    }
  });

  it('в каждом шаблоне edges.from/to — валидные индексы nodes', () => {
    for (const tpl of TEMPLATES) {
      for (const e of tpl.edges) {
        expect(e.from, `${tpl.id}: from`).toBeGreaterThanOrEqual(0);
        expect(e.from, `${tpl.id}: from`).toBeLessThan(tpl.nodes.length);
        expect(e.to, `${tpl.id}: to`).toBeGreaterThanOrEqual(0);
        expect(e.to, `${tpl.id}: to`).toBeLessThan(tpl.nodes.length);
      }
    }
  });

  it('каждый шаблон непустой (есть хотя бы один узел)', () => {
    for (const tpl of TEMPLATES) {
      expect(tpl.nodes.length, tpl.id).toBeGreaterThan(0);
    }
  });
});

describe('templateToGraph', () => {
  it('генерирует уникальные id узлов и рёбер, отличные от id шаблона', () => {
    const tpl = TEMPLATES[0];
    const { nodes, edges } = templateToGraph(tpl);
    expect(nodes).toHaveLength(tpl.nodes.length);
    expect(edges).toHaveLength(tpl.edges.length);
    const nodeIds = nodes.map(n => n.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    // Сгенерированный id — это не голый id шаблона (иначе повторная вставка
    // того же шаблона на карту столкнула бы id между собой).
    tpl.nodes.forEach((n, i) => expect(nodeIds[i]).not.toBe(n.id));
    edges.forEach(e => expect(e.id).not.toMatch(/^te_$/));
  });

  it('рёбра ссылаются на реально сгенерированные id узлов (source/target разрешаются)', () => {
    const tpl = TEMPLATES.find(t => t.id === 'basic_cycle')!;
    const { nodes, edges } = templateToGraph(tpl);
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const e of edges) {
      expect(nodeIds.has(e.source), `source ${e.source}`).toBe(true);
      expect(nodeIds.has(e.target), `target ${e.target}`).toBe(true);
    }
    // Первое ребро basic_cycle: t_trig → t_critic.
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('переносит позицию x/y из шаблона в position узла', () => {
    const tpl = TEMPLATES.find(t => t.id === 'basic_cycle')!;
    const { nodes } = templateToGraph(tpl);
    nodes.forEach((n, i) => {
      expect(n.position).toEqual({ x: tpl.nodes[i].x, y: tpl.nodes[i].y });
    });
  });

  it('данные узла (data) переносятся без изменений', () => {
    const tpl = TEMPLATES.find(t => t.id === 'basic_cycle')!;
    const { nodes } = templateToGraph(tpl);
    expect(nodes[0].data).toEqual(tpl.nodes[0].data);
  });

  it('тип связи по умолчанию — activates, когда в шаблоне не указан', () => {
    const tpl = TEMPLATES.find(t => t.id === 'critic_child_cope')!;
    const { edges } = templateToGraph(tpl);
    // c_child(1) → c_over(2) в шаблоне без явного type.
    const plain = edges.find(e => e.source.startsWith('c_child') && e.target.startsWith('c_over'));
    expect(plain?.data).toEqual({ edgeType: 'activates' });
  });

  it('явный тип связи из шаблона (suppresses) сохраняется', () => {
    const tpl = TEMPLATES.find(t => t.id === 'critic_child_cope')!;
    const { edges } = templateToGraph(tpl);
    const suppress = edges.find(e => e.source.startsWith('c_critic') && e.target.startsWith('c_child'));
    expect(suppress?.data).toEqual({ edgeType: 'suppresses' });
  });

  it('баг: две вставки одного шаблона в ОДНУ и ту же миллисекунду не должны сталкивать id узлов', () => {
    // Регресс: id узла раньше собирался как `${templateId}_${Date.now()}_${index}`
    // — при двух вставках в один тик (двойной клик, быстрый повторный клик по
    // шаблону) Date.now() совпадает, и id первой и второй вставки были ИДЕНТИЧНЫ
    // → на холсте React-ключи и xyflow node id сталкивались, второй набор узлов
    // тихо замещал первый вместо появления рядом. Зафиксировано монотонным
    // счётчиком вставок в templateToGraph (modeMapLayout.ts).
    const tpl = TEMPLATES[0];
    const fixedNow = 1_700_000_000_000;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    try {
      const first = templateToGraph(tpl);
      const second = templateToGraph(tpl);
      const firstIds = new Set(first.nodes.map(n => n.id));
      const overlap = second.nodes.filter(n => firstIds.has(n.id));
      expect(overlap).toEqual([]);
      const firstEdgeIds = new Set(first.edges.map(edge => edge.id));
      const edgeOverlap = second.edges.filter(edge => firstEdgeIds.has(edge.id));
      expect(edgeOverlap).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
