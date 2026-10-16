import { describe, it, expect } from 'vitest';
import type { ConceptSchemaLink } from '../../apiTypes';
import {
  emptySchemaLink,
  findSchemaLink,
  isSchemaLinkEmpty,
  normalizeSchemaLinks,
  upsertSchemaLink,
} from './schemaLinks';

const link = (schemaId: string, patch: Partial<ConceptSchemaLink> = {}) => ({
  ...emptySchemaLink(schemaId),
  ...patch,
});

describe('normalizeSchemaLinks', () => {
  it('не массив — пустой массив', () => {
    for (const raw of [null, undefined, 'x', 42, {}, { schemaId: 'a' }]) {
      expect(normalizeSchemaLinks(raw)).toEqual([]);
    }
  });

  it('выбрасывает элементы без строкового schemaId', () => {
    expect(
      normalizeSchemaLinks([
        null,
        'x',
        7,
        {},
        { schemaId: 5 },
        { schemaId: '' },
        { schemaId: 'failure' },
      ]),
    ).toEqual([emptySchemaLink('failure')]);
  });

  it('недостающие поля становятся пустыми, нестроковые needIds выбрасываются', () => {
    expect(
      normalizeSchemaLinks([
        {
          schemaId: 'failure',
          belief: 5,
          origin: null,
          needIds: ['attachment', 1, null, 'play'],
        },
        { schemaId: 'mistrust', needIds: 'attachment' },
      ]),
    ).toEqual([
      {
        schemaId: 'failure',
        belief: '',
        origin: '',
        needIds: ['attachment', 'play'],
      },
      emptySchemaLink('mistrust'),
    ]);
  });

  it('дубль schemaId — остаётся первый; тексты сохраняются как есть', () => {
    expect(
      normalizeSchemaLinks([
        { schemaId: 'failure', belief: ' я верю ' },
        { schemaId: 'failure', belief: 'дубль' },
      ]),
    ).toEqual([link('failure', { belief: ' я верю ' })]);
  });
});

describe('findSchemaLink / upsertSchemaLink', () => {
  it('нет связи — пустая заготовка с нужным schemaId', () => {
    expect(findSchemaLink([], 'failure')).toEqual(emptySchemaLink('failure'));
    const a = link('failure', { belief: 'х' });
    expect(findSchemaLink([a], 'failure')).toBe(a);
  });

  it('upsert заменяет по schemaId, добавляет новую в конец и не мутирует исходник', () => {
    const a = link('a', { belief: '1' });
    const b = link('b', { belief: '2' });
    const src = [a, b];
    const replaced = upsertSchemaLink(src, { ...a, belief: 'новое' });
    expect(replaced).toEqual([{ ...a, belief: 'новое' }, b]);
    expect(src).toEqual([a, b]);
    expect(upsertSchemaLink(src, link('c'))).toEqual([a, b, link('c')]);
  });
});

describe('isSchemaLinkEmpty', () => {
  it('пробелы вместо текста — пусто; текст или потребность — не пусто', () => {
    expect(isSchemaLinkEmpty(link('a', { belief: '  ', origin: '\n' }))).toBe(
      true,
    );
    expect(isSchemaLinkEmpty(link('a', { belief: 'х' }))).toBe(false);
    expect(isSchemaLinkEmpty(link('a', { origin: 'х' }))).toBe(false);
    expect(isSchemaLinkEmpty(link('a', { needIds: ['play'] }))).toBe(false);
  });
});
