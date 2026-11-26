import { describe, it, expect, vi } from 'vitest';
import { conceptGraphHandlers } from './conceptGraphHandlers';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';

const make = (patch = vi.fn(), over = {}) => ({
  patch,
  ...conceptGraphHandlers({
    modeIds: [],
    modeLinks: [],
    schemaLinks: [],
    schemaIds: [],
    patch,
    ...over,
  }),
});

describe('conceptGraphHandlers', () => {
  it('onChangeLink заменяет связь по modeId и не трогает остальные', () => {
    const a = emptyModeLink('a');
    const b = { ...emptyModeLink('b'), alias: 'Б' };
    const { onChangeLink, patch } = make(vi.fn(), { modeLinks: [a, b] });
    onChangeLink({ ...a, alias: 'А' });
    expect(patch).toHaveBeenCalledWith({
      modeLinks: [{ ...a, alias: 'А' }, b],
    });
  });

  it('onChangeSchemaLink заменяет тексты схемы по schemaId и добавляет новую', () => {
    const a = { ...emptySchemaLink('a'), belief: 'раз' };
    const { onChangeSchemaLink, patch } = make(vi.fn(), { schemaLinks: [a] });
    onChangeSchemaLink({ ...a, belief: 'два' });
    expect(patch).toHaveBeenLastCalledWith({
      schemaLinks: [{ ...a, belief: 'два' }],
    });
    onChangeSchemaLink(emptySchemaLink('b'));
    expect(patch).toHaveBeenLastCalledWith({
      schemaLinks: [a, emptySchemaLink('b')],
    });
  });

  it('onAddSchema добавляет схему в концептуализацию', () => {
    const { onAddSchema, patch } = make(vi.fn(), { schemaIds: ['failure'] });
    onAddSchema('abandonment');
    expect(patch).toHaveBeenCalledWith({
      schemaIds: ['failure', 'abandonment'],
    });
  });

  it('onAddSchema: схема уже есть — ничего не пишет', () => {
    const { onAddSchema, patch } = make(vi.fn(), { schemaIds: ['failure'] });
    onAddSchema('failure');
    expect(patch).not.toHaveBeenCalled();
  });

  it('onToggleSchema ставит схему в концептуализацию', () => {
    const { onToggleSchema, patch } = make(vi.fn(), { schemaIds: ['failure'] });
    onToggleSchema('abandonment');
    expect(patch).toHaveBeenLastCalledWith({
      schemaIds: ['failure', 'abandonment'],
    });
  });

  it('onToggleSchema снимает схему и убирает её из связей режимов одним патчем; тексты схемы не трогает', () => {
    const critic = {
      ...emptyModeLink('guilt_critic'),
      schemaIds: ['failure', 'mistrust'],
    };
    const child = {
      ...emptyModeLink('vulnerable_child'),
      schemaIds: ['mistrust'],
    };
    const { onToggleSchema, patch } = make(vi.fn(), {
      modeIds: ['guilt_critic', 'vulnerable_child'],
      modeLinks: [critic, child],
      schemaLinks: [{ ...emptySchemaLink('failure'), belief: 'я хуже' }],
      schemaIds: ['failure'],
    });
    onToggleSchema('failure');
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({
      schemaIds: [],
      modeLinks: [{ ...critic, schemaIds: ['mistrust'] }, child],
    });
    // schemaLinks в патче нет: тексты остаются в данных
    expect(patch.mock.calls[0][0]).not.toHaveProperty('schemaLinks');
  });

  it('onToggleSchema: схема, видимая только по ссылке режима с карты, тоже снимается; ссылка режима не с карты схему не показывает', () => {
    const link = { ...emptyModeLink('guilt_critic'), schemaIds: ['mistrust'] };
    const onMap = make(vi.fn(), {
      modeIds: ['guilt_critic'],
      modeLinks: [link],
    });
    onMap.onToggleSchema('mistrust');
    expect(onMap.patch).toHaveBeenCalledWith({
      schemaIds: [],
      modeLinks: [{ ...link, schemaIds: [] }],
    });
    const offMap = make(vi.fn(), { modeIds: [], modeLinks: [link] });
    offMap.onToggleSchema('mistrust');
    expect(offMap.patch).toHaveBeenCalledWith({ schemaIds: ['mistrust'] });
  });
});
