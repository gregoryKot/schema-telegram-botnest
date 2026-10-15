import { describe, it, expect, vi } from 'vitest';
import { conceptGraphHandlers } from './conceptGraphHandlers';
import { emptyModeLink } from './modeLinks';

describe('conceptGraphHandlers', () => {
  it('onChangeLink заменяет связь по modeId и не трогает остальные', () => {
    const patch = vi.fn();
    const a = emptyModeLink('a');
    const b = { ...emptyModeLink('b'), alias: 'Б' };
    const { onChangeLink } = conceptGraphHandlers({
      modeLinks: [a, b],
      schemaIds: [],
      patch,
    });
    onChangeLink({ ...a, alias: 'А' });
    expect(patch).toHaveBeenCalledWith({
      modeLinks: [{ ...a, alias: 'А' }, b],
    });
  });

  it('onAddSchema добавляет схему в концептуализацию', () => {
    const patch = vi.fn();
    const { onAddSchema } = conceptGraphHandlers({
      modeLinks: [],
      schemaIds: ['failure'],
      patch,
    });
    onAddSchema('abandonment');
    expect(patch).toHaveBeenCalledWith({
      schemaIds: ['failure', 'abandonment'],
    });
  });

  it('onAddSchema: схема уже есть — ничего не пишет', () => {
    const patch = vi.fn();
    conceptGraphHandlers({
      modeLinks: [],
      schemaIds: ['failure'],
      patch,
    }).onAddSchema('failure');
    expect(patch).not.toHaveBeenCalled();
  });
});
