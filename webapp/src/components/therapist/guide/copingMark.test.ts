import { describe, expect, it, vi } from 'vitest';
import type { ClientConceptualization } from '../../../api';
import { applyCopingRemote, copingAddress, copingPatch, filterClients, graphCopingTarget } from './copingMark';

const cell = { schemaId: 'subjugation', style: 'surrender' } as const;
const concept = (over: Partial<ClientConceptualization> = {}) =>
  ({ schemaIds: [], schemaLinks: [], updatedAt: '2026-11-20T10:00:00.000Z', ...over }) as unknown as ClientConceptualization;

describe('«Про клиента» на копинге', () => {
  it('адрес копинга — тот же, что у таблицы смыслов справочника', () => {
    expect(copingAddress(cell)).toBe('schema:subjugation/coping.surrender');
  });

  it('схемы нет в схеме случая — патч добавляет её вместе со стилем, версия — от прочитанной строки', () => {
    expect(copingPatch(concept(), cell, { kind: 'mark', note: 'уступает' })).toEqual({
      baseVersion: '2026-11-20T10:00:00.000Z',
      schemaIds: ['subjugation'],
      schemaLinksPatch: { upsert: [{ schemaId: 'subjugation', belief: '', origin: '', needIds: [], coping: ['surrender'], copingNotes: { surrender: 'уступает' } }] },
    });
  });

  it('снятие убирает стиль, схему из схемы случая не трогает', () => {
    const marked = concept({ schemaIds: ['subjugation'], schemaLinks: [{ schemaId: 'subjugation', belief: 'b', origin: '', needIds: [], coping: ['surrender'] }] });
    const patch = copingPatch(marked, cell, { kind: 'unmark' });
    expect(patch).not.toHaveProperty('schemaIds');
    expect(patch.schemaLinksPatch?.upsert?.[0]).toEqual({ schemaId: 'subjugation', belief: 'b', origin: '', needIds: [] });
  });

  it('строку изменили (409) — перечитать и повторить один раз; другая ошибка уходит наверх', async () => {
    const fresh = concept({ updatedAt: '2026-11-20T11:00:00.000Z', schemaIds: ['subjugation'] });
    const api = {
      getConceptualization: vi.fn().mockResolvedValue(fresh),
      saveConceptualization: vi.fn().mockRejectedValueOnce({ status: 409 }).mockResolvedValueOnce(fresh),
    };
    await expect(applyCopingRemote(api, 7, cell, { kind: 'mark', note: '' }, concept())).resolves.toBe(fresh);
    expect(api.saveConceptualization.mock.calls[1][1]).toMatchObject({ baseVersion: '2026-11-20T11:00:00.000Z' });
    expect(api.saveConceptualization.mock.calls[1][1]).not.toHaveProperty('schemaIds');
    api.saveConceptualization.mockRejectedValueOnce({ status: 500 });
    await expect(applyCopingRemote(api, 7, cell, { kind: 'unmark' }, concept())).rejects.toEqual({ status: 500 });
  });

  it('из карточки клиента: отметка правит связи схемы случая и добавляет схему', async () => {
    const graph = {
      source: { modeLinks: [], schemaLinks: [], schemaIds: [] },
      onChangeLink: vi.fn(), onChangeSchemaLink: vi.fn(), onAddSchema: vi.fn(),
    };
    const target = graphCopingTarget(graph, 'Анна', cell);
    expect(target).toMatchObject({ name: 'Анна', marked: false, note: '' });
    await target.apply({ kind: 'mark', note: '' });
    expect(graph.onAddSchema).toHaveBeenCalledWith('subjugation');
    expect(graph.onChangeSchemaLink).toHaveBeenCalledWith(expect.objectContaining({ coping: ['surrender'] }));
  });

  it('поиск клиента — по имени без регистра', () => {
    const list = [{ telegramId: 1, name: 'Анна' }, { telegramId: 2, name: 'Борис' }] as never[];
    expect(filterClients(list, 'ан')).toEqual([list[0]]);
    expect(filterClients(list, '  ')).toEqual(list);
  });
});
