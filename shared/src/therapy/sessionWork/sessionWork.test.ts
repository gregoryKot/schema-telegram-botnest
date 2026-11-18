import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../exercises/exerciseCatalog';
import { buildTechniqueGuides } from '../../schemaTherapy/guide';
import {
  CUSTOM_WORK_FIELDS,
  EXERCISE_WORK_FIELDS,
  TECHNIQUE_WORK,
  workFields,
} from './fields';
import { WORK_OPTION_GROUPS, newWorkItem, workTitle } from './names';
import { normalizeSessionWork } from './normalize';
import { WORK_FIELDS_MAX, WORK_ITEMS_MAX } from './types';

const tr = (ty: string) => ty;

describe('каталог «Что делали»', () => {
  it('у каждой техники библиотеки и каждого упражнения есть название и поля', () => {
    const techniqueIds = buildTechniqueGuides(tr).map((t) => t.id);
    expect(Object.keys(TECHNIQUE_WORK).sort()).toEqual(
      [...techniqueIds].sort(),
    );
    expect(techniqueIds).toHaveLength(41);
    const exerciseIds = EXERCISES.map((e) => e.id);
    expect(Object.keys(EXERCISE_WORK_FIELDS).sort()).toEqual(
      [...exerciseIds].sort(),
    );
    const all = [
      ...techniqueIds.map((id) => workFields('technique', id)),
      ...exerciseIds.map((id) => workFields('exercise', id)),
      CUSTOM_WORK_FIELDS,
    ];
    for (const defs of all) {
      expect(defs!.length).toBeGreaterThan(0);
      expect(defs!.length).toBeLessThanOrEqual(WORK_FIELDS_MAX);
      expect(new Set(defs!.map(([key]) => key)).size).toBe(defs!.length);
      for (const [, label] of defs!) expect(label.trim()).not.toBe('');
    }
  });

  it('список выбора: 41 техника, 8 упражнений, «Своё»; название пункта — из него', () => {
    expect(WORK_OPTION_GROUPS.map((g) => g.options.length)).toEqual([41, 8, 1]);
    for (const option of WORK_OPTION_GROUPS.flatMap((g) => g.options)) {
      const item = newWorkItem(option);
      expect(workTitle(item)).toBe(option.name);
      expect(normalizeSessionWork([item])).toEqual([item]);
    }
    const custom = {
      ...newWorkItem({ kind: 'custom', name: '' }),
      customName: 'Песочница',
    };
    expect(workTitle(custom)).toBe('Песочница');
    expect(newWorkItem(WORK_OPTION_GROUPS[0].options[0]).id).not.toBe(
      newWorkItem(WORK_OPTION_GROUPS[0].options[0]).id,
    );
  });
});

describe('normalizeSessionWork', () => {
  const base = { id: 'a', kind: 'technique', refId: 'chairwork' };

  it('не массив и мусор внутри — пусто', () => {
    for (const bad of [null, undefined, 'x', {}, [null, 5, 'x', {}]])
      expect(normalizeSessionWork(bad)).toEqual([]);
  });

  it('незнакомый вид, техника и ключ поля отбрасываются; пустые поля не хранятся', () => {
    const out = normalizeSessionWork([
      {
        ...base,
        fields: { theme: ' стыд ', ending: '  ', scene: 'чужое', x: 1 },
      },
      { ...base, id: 'b', refId: 'toString' },
      { ...base, id: 'c', kind: 'song' },
      { ...base, id: 'd', kind: 'exercise' },
      { ...base, id: '' },
    ]);
    expect(out).toEqual([
      {
        ...base,
        modeIds: [],
        schemaIds: [],
        needIds: [],
        fields: { theme: 'стыд' },
      },
    ]);
  });

  it('режет по границам: пункты, списки id, значение, название своего', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...base,
      id: `i${i}`,
    }));
    expect(normalizeSessionWork(many)).toHaveLength(WORK_ITEMS_MAX);
    const [item] = normalizeSessionWork([
      {
        id: 'a',
        kind: 'custom',
        refId: 'лишнее',
        customName: 'н'.repeat(100),
        modeIds: [
          ...Array.from({ length: 20 }, (_, i) => `m${i}`),
          'm0',
          7,
          '',
        ],
        needIds: ['play', 'play'],
        fields: { what: 'ж'.repeat(700), result: 'ок' },
      },
    ]);
    expect(item.customName).toHaveLength(80);
    expect(item.refId).toBeUndefined();
    expect(item.modeIds).toHaveLength(12);
    expect(item.needIds).toEqual(['play']);
    expect(item.schemaIds).toEqual([]);
    expect(item.fields.what).toHaveLength(600);
    expect(item.fields.result).toBe('ок');
  });
});
