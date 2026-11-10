// Связь колеса потребностей с концептуализацией (владелец 2026-11-10): линии ✗/✓ к секторам
// дописываются в schemaLinks/modeLinks needIds — те же связи, что рисует схема случая.
import { describe, it, expect } from 'vitest';
import { needAppend, needLinksOf } from './conceptNeedSync';
import { addedOnCanvas, appendBody, canvasConcept, type GraphNode } from './conceptSync';
import type { ClientConcept } from './clientConceptContext';

const wheel: GraphNode = { id: 'w', type: 'needs', data: { label: 'К', wheel: {} } };
const schema: GraphNode = { id: 's', type: 'schema', data: { label: 'С', schemaId: 'abandonment' } };
const ha: GraphNode = { id: 'h', type: 'healthy', data: { label: 'ЗВ', modeId: 'healthy_adult' } };
const child: GraphNode = { id: 'c', type: 'child', data: { label: 'Р', modeId: 'vulnerable_child' } };
const pill: GraphNode = { id: 'p', type: 'need', data: { label: 'Игра', needId: 'play' } };
const to = (source: string, target: string, targetHandle?: string, sourceHandle?: string) => ({ source, target, targetHandle, sourceHandle });
const concept = (c: Partial<ClientConcept> = {}): ClientConcept => ({ schemaIds: [], modeIds: [], modeLinks: [], schemaLinks: [], ...c });

describe('needLinksOf — связи с потребностями на холсте', () => {
  it('схема → сектор колеса и здоровый режим → сектор, в любую сторону линии', () => {
    const keys = needLinksOf([wheel, schema, ha], [to('s', 'w', 'need:attachment'), to('w', 'h', undefined, 'need:play')]);
    expect([...keys].sort()).toEqual(['m:healthy_adult play', 's:abandonment attachment']);
  });

  it('старая таблетка потребности тоже считается; линия к колесу без сектора и от не-здорового режима — нет', () => {
    const keys = needLinksOf([wheel, schema, child, pill], [to('s', 'p'), to('s', 'w', 'c'), to('c', 'w', 'need:play')]);
    expect([...keys]).toEqual(['s:abandonment play']);
  });
});

describe('needAppend и appendBody — что уходит в концептуализацию', () => {
  it('уже записанное в концептуализации не повторяется', () => {
    const c = concept({ schemaLinks: [{ schemaId: 'abandonment', belief: '', origin: '', needIds: ['attachment'] }] });
    const out = needAppend(new Set(['s:abandonment attachment', 's:abandonment play', 'm:healthy_adult play']), c);
    expect(out.schemaLinks).toEqual([{ schemaId: 'abandonment', needIds: ['play'] }]);
    expect([...out.modeNeeds]).toEqual([['healthy_adult', ['play']]]);
  });

  it('провёл ✗ от схемы и ✓ от Здорового Взрослого к колесу — тело с schemaLinks и needIds режима', () => {
    const before = canvasConcept([wheel, schema, ha], []);
    const after = canvasConcept([wheel, schema, ha], [to('s', 'w', 'need:attachment'), to('h', 'w', 'need:play')]);
    const c = concept({ schemaIds: ['abandonment'], modeIds: ['healthy_adult'] });
    expect(appendBody(addedOnCanvas(before, after), c)).toEqual({
      modeLinks: [{ modeId: 'healthy_adult', schemaIds: [], needIds: ['play'] }],
      schemaLinks: [{ schemaId: 'abandonment', needIds: ['attachment'] }],
    });
  });

  it('связь схема ⇄ режим и ✓ того же режима — одна запись режима', () => {
    const before = canvasConcept([wheel, schema, ha], []);
    const after = canvasConcept([wheel, schema, ha], [to('s', 'h'), to('h', 'w', 'need:limits')]);
    const body = appendBody(addedOnCanvas(before, after), concept({ schemaIds: ['abandonment'], modeIds: ['healthy_adult'] }));
    expect(body?.modeLinks).toEqual([{ modeId: 'healthy_adult', schemaIds: ['abandonment'], needIds: ['limits'] }]);
  });

  it('убранная линия ничего не пишет', () => {
    const withLine = canvasConcept([wheel, schema], [to('s', 'w', 'need:attachment')]);
    const without = canvasConcept([wheel, schema], []);
    expect(appendBody(addedOnCanvas(withLine, without), concept())).toBeNull();
  });
});
