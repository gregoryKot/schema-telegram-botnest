import { describe, it, expect } from 'vitest';
import {
  buildTaskCatalog,
  catalogTaskWhen,
  collectTaskCatalog,
  customTaskText,
  searchTaskCatalog,
} from './taskCatalog';
import * as guide from '../../schemaTherapy/guide';
import { TASK_TEXT_MAX } from '../../limits/textLimits';

const tr = (ty: string) => ty;
const custom = (title: string, text = 'что делать') => ({
  kind: 'custom' as const,
  title,
  text,
});

describe('collectTaskCatalog', () => {
  const catalog = collectTaskCatalog(
    [
      {
        modeId: 'm1',
        betweenSessions: [
          custom('Письмо Критику', 'первый текст'),
          { kind: 'task', type: 'safe_place', title: 'Безопасное место' },
        ],
      },
      {
        modeId: 'm2',
        betweenSessions: [custom('письмо  критику!', 'второй текст')],
      },
    ],
    [
      {
        schemaId: 's1',
        betweenSessions: [custom('Письмо критику'), custom('Ещё одно')],
      },
      { schemaId: 's2', betweenSessions: [custom('Еще одно')] },
    ],
  );

  it('повторы по названию склеиваются, упражнения с экраном не попадают', () => {
    expect(catalog.map((t) => t.title)).toEqual(['Письмо Критику', 'Ещё одно']);
    expect(catalog[0].why).toBe('');
    expect(catalog[0].id).toBe('письмо-критику');
  });

  it('разные тексты одного названия — варианты; где стоит каждый, выводится из данных; группа — по ним', () => {
    expect(catalog[0].group).toBe('modes');
    expect(catalog[0].variants).toEqual([
      { text: 'первый текст', forModes: ['m1'], forSchemas: [] },
      { text: 'второй текст', forModes: ['m2'], forSchemas: [] },
      { text: 'что делать', forModes: [], forSchemas: ['s1'] },
    ]);
    expect(catalog[1].group).toBe('schemas');
    expect(catalog[1].variants).toEqual([
      { text: 'что делать', forModes: [], forSchemas: ['s1', 's2'] },
    ]);
  });

  it('поиск по названию без регистра и «ё», пустые группы пропадают', () => {
    expect(
      searchTaskCatalog(catalog, 'ЕЩЕ').map((g) => [g.title, g.items.length]),
    ).toEqual([['При схемах', 1]]);
    expect(searchTaskCatalog(catalog, '').map((g) => g.id)).toEqual([
      'modes',
      'schemas',
    ]);
    expect(searchTaskCatalog(catalog, 'нет такого')).toEqual([]);
  });
});

describe('buildTaskCatalog на данных справочника', () => {
  const catalog = buildTaskCatalog(guide, tr);

  it('id уникальны, у каждой записи есть «когда давать», текст задания влезает в лимит', () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(new Set(catalog.map((t) => t.id)).size).toBe(catalog.length);
    for (const task of catalog) {
      for (const variant of task.variants) {
        expect(catalogTaskWhen(variant).length).toBe(
          variant.forModes.length + variant.forSchemas.length,
        );
        expect(catalogTaskWhen(variant).length).toBeGreaterThan(0);
        expect(
          customTaskText({ title: task.title, text: variant.text }).length,
        ).toBeLessThanOrEqual(TASK_TEXT_MAX);
      }
    }
  });

  it('у семи названий тексты в режимах и схемах разные — видны все варианты', () => {
    const many = catalog.filter((t) => t.variants.length > 1);
    expect(many.map((t) => t.title)).toContain('Прямая просьба');
    expect(many).toHaveLength(7);
  });
});
