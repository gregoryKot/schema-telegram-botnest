import { describe, it, expect } from 'vitest';
import type { ConceptModeLink } from '../../apiTypes';
import {
  emptyModeLink,
  findModeLink,
  isModeLinkEmpty,
  normalizeModeLinks,
  upsertModeLink,
} from './modeLinks';

const link = (modeId: string, patch: Partial<ConceptModeLink> = {}) => ({
  ...emptyModeLink(modeId),
  ...patch,
});

describe('normalizeModeLinks', () => {
  it('не массив — пустой массив', () => {
    for (const raw of [null, undefined, 'x', 42, {}, { modeId: 'a' }]) {
      expect(normalizeModeLinks(raw)).toEqual([]);
    }
  });

  it('выбрасывает элементы без строкового modeId', () => {
    expect(
      normalizeModeLinks([
        null,
        'x',
        7,
        {},
        { modeId: 5 },
        { modeId: '' },
        { modeId: 'ok' },
      ]),
    ).toEqual([emptyModeLink('ok')]);
  });

  it('недостающие поля становятся пустыми, нестроковые элементы массивов выбрасываются', () => {
    const [res] = normalizeModeLinks([
      {
        modeId: 'm',
        alias: 5,
        schemaIds: ['a', 1, null, 'b'],
        needIds: 'attachment',
        origin: null,
      },
    ]);
    expect(res).toEqual({
      modeId: 'm',
      alias: '',
      schemaIds: ['a', 'b'],
      needIds: [],
      origin: '',
      manifest: '',
      strategy: '',
    });
  });

  it('дубль modeId — остаётся первый', () => {
    const res = normalizeModeLinks([
      { modeId: 'm', alias: 'первый' },
      { modeId: 'm', alias: 'второй' },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].alias).toBe('первый');
  });

  it('чужие поля не протекают в результат', () => {
    const [res] = normalizeModeLinks([{ modeId: 'm', extra: 'x' }]);
    expect(Object.keys(res).sort()).toEqual([
      'alias',
      'manifest',
      'modeId',
      'needIds',
      'origin',
      'schemaIds',
      'strategy',
    ]);
  });
});

describe('findModeLink / upsertModeLink', () => {
  it('find: нет связи — пустая связь этого режима', () => {
    expect(findModeLink([], 'm')).toEqual(emptyModeLink('m'));
    const l = link('m', { alias: 'Судья' });
    expect(findModeLink([l], 'm')).toBe(l);
  });

  it('upsert заменяет по modeId, сохраняя порядок, и не мутирует исходный массив', () => {
    const a = link('a', { alias: 'A' });
    const b = link('b');
    const src = [a, b];
    const res = upsertModeLink(src, link('a', { alias: 'A2' }));
    expect(res.map((l) => l.alias)).toEqual(['A2', '']);
    expect(src).toEqual([a, b]);
    expect(res).not.toBe(src);
  });

  it('upsert добавляет новую связь в конец', () => {
    const src = [link('a')];
    const res = upsertModeLink(src, link('z', { alias: 'Z' }));
    expect(res.map((l) => l.modeId)).toEqual(['a', 'z']);
    expect(src).toHaveLength(1);
  });
});

describe('isModeLinkEmpty', () => {
  it('пустая связь и связь из одних пробелов — пустые', () => {
    expect(isModeLinkEmpty(emptyModeLink('m'))).toBe(true);
    expect(isModeLinkEmpty(link('m', { alias: '  ', origin: '\n' }))).toBe(
      true,
    );
  });

  it('любое заполненное поле делает связь непустой', () => {
    const fields: Partial<ConceptModeLink>[] = [
      { alias: 'Судья' },
      { schemaIds: ['abandonment'] },
      { needIds: ['attachment'] },
      { origin: 'х' },
      { manifest: 'х' },
      { strategy: 'х' },
    ];
    for (const patch of fields) {
      expect(isModeLinkEmpty(link('m', patch)), JSON.stringify(patch)).toBe(
        false,
      );
    }
  });
});
