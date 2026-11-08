// Холст → поля (#963), чистая часть: что на холсте уходит в концептуализацию.
import { describe, it, expect } from 'vitest';
import {
  addedOnCanvas, appendBody, canvasConcept, isEmptyCanvas, keepOnCanvas, missingOnCanvas, toClientConcept,
  type GraphEdge, type GraphNode,
} from './conceptSync';
import type { ClientConcept } from './clientConceptContext';

const mode = (id: string, modeId: string, type = 'critic'): GraphNode => ({ id, type, data: { modeId, label: modeId } });
const schema = (id: string, schemaId: string, type = 'schema'): GraphNode => ({ id, type, data: { schemaId, label: schemaId } });
const edge = (source: string, target: string): GraphEdge => ({ source, target });
const concept = (c: Partial<ClientConcept> = {}): ClientConcept => ({ schemaIds: [], modeIds: [], modeLinks: [], ...c });
const link = (modeId: string, schemaIds: string[]) => ({ modeId, alias: '', schemaIds, needIds: [], origin: '', manifest: '', strategy: '' });

/** Тело записи при переходе холста из `before` в `after`. */
function bodyFor(before: [GraphNode[], GraphEdge[]], after: [GraphNode[], GraphEdge[]], c = concept()) {
  return appendBody(addedOnCanvas(canvasConcept(...before), canvasConcept(...after)), c);
}

describe('canvasConcept', () => {
  it('режим — по modeId из справочника, схема — фигура «схема»; опыт, потребности и свой режим не в счёт', () => {
    const c = canvasConcept([
      mode('m1', 'demanding_critic'),
      mode('m2', 'my_own_mode', 'custom'),
      { id: 'free', type: 'custom', data: { label: 'Свой режим' } },
      schema('s1', 'defectiveness'),
      schema('o1', 'abandonment', 'origin'),
      { id: 'p1', type: 'need', data: { needId: 'safety', label: 'Безопасность' } },
    ], []);
    expect([...c.modes]).toEqual(['demanding_critic']);
    expect([...c.schemas]).toEqual(['defectiveness']);
  });

  it('связь — линия схема ⇄ режим в любую сторону; режим ⇄ режим и опыт ⇄ схема — нет', () => {
    const nodes = [mode('m1', 'demanding_critic'), mode('m2', 'vulnerable_child', 'child'), schema('s1', 'defectiveness'), schema('o1', 'defectiveness', 'origin')];
    const forward = canvasConcept(nodes, [edge('s1', 'm1')]);
    const backward = canvasConcept(nodes, [edge('m1', 's1')]);
    expect([...forward.links]).toEqual([...backward.links]);
    expect(forward.links.size).toBe(1);
    expect(canvasConcept(nodes, [edge('m1', 'm2'), edge('o1', 's1')]).links.size).toBe(0);
  });

  it('схема, поставленная на режим в панели («Схемы режима»), — та же связь, что линия; у своего режима без modeId — нет', () => {
    const withPills = (id: string, modeId: string | undefined, schemaIds: string[]): GraphNode =>
      ({ id, type: 'child', data: { label: 'x', schemaIds, ...(modeId ? { modeId } : {}) } });
    const c = canvasConcept([withPills('m1', 'vulnerable_child', ['abandonment', 'no_such_schema']), withPills('m2', undefined, ['mistrust'])], []);
    expect([...c.links]).toEqual(['vulnerable_child abandonment']);
    expect([...c.schemas]).toEqual([]); // фигуры схемы на холсте нет — «Добавить на карту» её по-прежнему предложит
  });

  it('добавил таблетку схемы на режим — в поля уходит связь режима со схемой', () => {
    const before: [GraphNode[], GraphEdge[]] = [[mode('m1', 'vulnerable_child', 'child')], []];
    const after: [GraphNode[], GraphEdge[]] = [[{ id: 'm1', type: 'child', data: { modeId: 'vulnerable_child', label: 'x', schemaIds: ['abandonment'] } }], []];
    expect(bodyFor(before, after, concept({ modeIds: ['vulnerable_child'] })))
      .toEqual({ modeLinks: [{ modeId: 'vulnerable_child', schemaIds: ['abandonment'] }] });
  });
});

describe('appendBody — что уходит в поля', () => {
  it('поставил режим — тело с modeIds', () => {
    expect(bodyFor([[], []], [[mode('m1', 'demanding_critic')], []])).toEqual({ modeIds: ['demanding_critic'] });
  });

  it('поставил схему — тело с schemaIds', () => {
    expect(bodyFor([[], []], [[schema('s1', 'defectiveness')], []])).toEqual({ schemaIds: ['defectiveness'] });
  });

  it('провёл линию схема → режим — тело с modeLinks, режим и схема уже в полях не повторяются', () => {
    const nodes = [mode('m1', 'demanding_critic'), schema('s1', 'defectiveness')];
    const c = concept({ modeIds: ['demanding_critic'], schemaIds: ['defectiveness'] });
    expect(bodyFor([nodes, []], [nodes, [edge('s1', 'm1')]], c))
      .toEqual({ modeLinks: [{ modeId: 'demanding_critic', schemaIds: ['defectiveness'] }] });
    expect(bodyFor([nodes, []], [nodes, [edge('m1', 's1')]], c))
      .toEqual({ modeLinks: [{ modeId: 'demanding_critic', schemaIds: ['defectiveness'] }] });
  });

  it('удаление узла или линии ничего не пишет', () => {
    const nodes = [mode('m1', 'demanding_critic'), schema('s1', 'defectiveness')];
    expect(bodyFor([nodes, [edge('s1', 'm1')]], [[nodes[0]], []])).toBeNull();
    expect(bodyFor([nodes, [edge('s1', 'm1')]], [nodes, []])).toBeNull();
  });

  it('режим на карте, убранный из полей, при открытии карты не уходит: сравнение с прошлым холстом, не с полями', () => {
    const opened: [GraphNode[], GraphEdge[]] = [[mode('m1', 'demanding_critic')], []];
    const fieldsWithout = concept({ modeIds: [] });
    // То же состояние холста (перемещение, сохранение раскладки) — писать нечего.
    expect(bodyFor(opened, opened, fieldsWithout)).toBeNull();
    // Дописал рядом другой режим — уходит только он.
    expect(bodyFor(opened, [[...opened[0], mode('m2', 'punitive_critic')], []], fieldsWithout)).toEqual({ modeIds: ['punitive_critic'] });
  });

  it('уже есть в полях — не пишется; схема из связи режима считается своей', () => {
    const c = concept({ modeIds: ['demanding_critic'], modeLinks: [link('demanding_critic', ['defectiveness'])] });
    expect(bodyFor([[], []], [[mode('m1', 'demanding_critic'), schema('s1', 'defectiveness')], [edge('s1', 'm1')]], c)).toBeNull();
  });

  it('концептуализация не загрузилась — пишется как есть (сервер объединяет)', () => {
    const added = addedOnCanvas(canvasConcept([], []), canvasConcept([mode('m1', 'demanding_critic')], []));
    expect(appendBody(added, 'failed')).toEqual({ modeIds: ['demanding_critic'] });
    expect(appendBody(added, null)).toEqual({ modeIds: ['demanding_critic'] });
  });

  it('поставил и сразу убрал — после keepOnCanvas писать нечего', () => {
    const added = addedOnCanvas(canvasConcept([], []), canvasConcept([mode('m1', 'demanding_critic')], []));
    expect(isEmptyCanvas(keepOnCanvas(added, canvasConcept([], [])))).toBe(true);
  });
});

describe('missingOnCanvas — в полях есть, на карте нет', () => {
  it('режимы и схемы концептуализации без фигуры на холсте; неизвестные id не в счёт', () => {
    const c = concept({ modeIds: ['demanding_critic', 'vulnerable_child', 'unknown_mode'], schemaIds: ['defectiveness', 'failure'] });
    const canvas = canvasConcept([mode('m1', 'vulnerable_child', 'child'), schema('s1', 'failure')], []);
    expect(missingOnCanvas(c, canvas)).toEqual({ modeIds: ['demanding_critic'], schemaIds: ['defectiveness'] });
  });

  it('всё на холсте — пусто', () => {
    const c = concept({ modeIds: ['demanding_critic'] });
    expect(missingOnCanvas(c, canvasConcept([mode('m1', 'demanding_critic')], []))).toEqual({ modeIds: [], schemaIds: [] });
  });
});

describe('toClientConcept', () => {
  it('ответ сервера → списки и нормализованные связи; null — пустая концептуализация', () => {
    expect(toClientConcept(null)).toEqual({ schemaIds: [], modeIds: [], modeLinks: [] });
    const c = toClientConcept({ modeIds: ['demanding_critic', 5], modeLinks: [{ modeId: 'demanding_critic', schemaIds: ['failure'] }, { alias: 'без id' }] });
    expect(c.modeIds).toEqual(['demanding_critic']);
    expect(c.modeLinks).toHaveLength(1);
  });
});
