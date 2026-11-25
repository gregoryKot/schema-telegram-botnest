// «Сохранил → нашёл»: пункты досбора по Янгу (гл. 4–8) доходят до собранного справочника.
import { describe, it, expect } from 'vitest';
import {
  buildConcernGuides,
  modeGuide,
  practiceNotes,
  schemaGuide,
  techniqueGuide,
} from './index';
import type { Tr } from './types';

const tr: Tr = (t) => t;
const has = (list: string[] | undefined, part: string) =>
  (list ?? []).some((x) => x.includes(part));

describe('досбор по Янгу (гл. 4–8) доходит до справочника', () => {
  it('схемы, режимы и техники получают пункты в «Подробнее»', () => {
    expect(
      has(schemaGuide(tr, 'mistrust')?.guide.more, 'просвещённый свидетель'),
    ).toBe(true);
    expect(
      has(schemaGuide(tr, 'defectiveness')?.guide.more, 'Эмоциональной'),
    ).toBe(true);
    expect(
      has(
        modeGuide(tr, 'detached_protector')?.more,
        'держит всех на расстоянии',
      ),
    ).toBe(true);
    expect(
      has(techniqueGuide(tr, 'imagery_rescripting')?.more, 'две цели'),
    ).toBe(true);
    expect(
      has(techniqueGuide(tr, 'mode_dialogue_imagery')?.more, 'надёжную фигуру'),
    ).toBe(true);
  });

  it('заметки «Для терапевта»: пары схем, блоки, сводка каналов', () => {
    const note = (id: string) => practiceNotes(tr).find((n) => n.id === id);
    expect(has(note('therapist_schema_scenarios')?.more, 'зависть')).toBe(true);
    expect(has(note('change_blocks')?.more, 'гирей')).toBe(true);
    expect(note('change_blocks')?.sources).toContain('[Янг, гл. 5]');
    expect(note('schema_channel_map')?.points.length).toBeGreaterThanOrEqual(3);
    expect(has(note('same_behavior_by_schema')?.more, 'При Недоверии')).toBe(
      true,
    );
  });

  it('кластер C получает раскладку по схемам Янга и связи', () => {
    const c = buildConcernGuides(tr).find((x) => x.id === 'cluster_c');
    expect(has(c?.differential, 'Подавление эмоций')).toBe(true);
    expect(c?.schemaIds).toEqual(
      expect.arrayContaining(['defectiveness', 'unrelenting_standards']),
    );
  });

  it('новые пункты входят в собранную запись ровно один раз', () => {
    const once = (list: string[] | undefined, part: string) =>
      (list ?? []).filter((x) => x.includes(part)).length;
    const rescript = techniqueGuide(tr, 'imagery_rescripting')?.more;
    expect(once(rescript, 'У работы с травмой в образе две цели')).toBe(1);
    expect(once(rescript, 'Кому образ замещающего родительства')).toBe(1);
    const diag = techniqueGuide(tr, 'diagnostic_imagery')?.more;
    expect(once(diag, 'Три задачи диагностического образа')).toBe(1);
    expect(once(diag, 'Почему образ действует иначе')).toBe(1);
  });
});
