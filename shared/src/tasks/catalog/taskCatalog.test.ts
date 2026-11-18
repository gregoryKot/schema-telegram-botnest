import { describe, it, expect } from 'vitest';
import {
  buildTaskCatalog,
  catalogTaskWhen,
  collectTaskCatalog,
  customTaskText,
  searchTaskCatalog,
} from './taskCatalog';
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
    expect(catalog[0].text).toBe('первый текст');
    expect(catalog[0].id).toBe('письмо-критику');
  });

  it('forModes и forSchemas выводятся из того, где пункт стоит; группа — по ним', () => {
    expect(catalog[0]).toMatchObject({
      forModes: ['m1', 'm2'],
      forSchemas: ['s1'],
      group: 'modes',
    });
    expect(catalog[1]).toMatchObject({
      forModes: [],
      forSchemas: ['s1', 's2'],
      group: 'schemas',
    });
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
  const catalog = buildTaskCatalog(tr);

  it('id уникальны, у каждой записи есть «когда давать», текст задания влезает в лимит', () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(new Set(catalog.map((t) => t.id)).size).toBe(catalog.length);
    for (const task of catalog) {
      expect(catalogTaskWhen(task).length).toBe(
        task.forModes.length + task.forSchemas.length,
      );
      expect(catalogTaskWhen(task).length).toBeGreaterThan(0);
      expect(customTaskText(task).length).toBeLessThanOrEqual(TASK_TEXT_MAX);
    }
  });
});
