// Правило владельца (2026-11): на одной вкладке справочника листы не в одном цвете и не без знака.
// Сверка идёт по настоящим текстам; красный образец — вкладка на одной бумаге и лист без знака.
import { describe, it, expect } from 'vitest';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { PRACTICE_GROUPS, TECHNIQUE_GROUPS } from '../../../../shared/src/schemaTherapy/guide/guideGroups';
import { PHASE_LOOK_KEYS } from '../../../../shared/src/theme/pathLook';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { PAPER_HUE } from '../../../../shared/src/theme/entityLook';
import { REFERENCE_TABS, buildReference, type ReferenceGroup, type ReferenceTab } from './guideReferenceModel';
import { huesNeeded, tabLookProblems, tabSheets } from './guideReferenceHues';

const tr = (ty: string) => ty;
const ref = buildReference(guide, tr);

/** Смысловые группы вкладки: группа режимов (копинги — одна), домен, потребность, канал, статья, стадия, раздел. */
const SEMANTIC_GROUPS: Record<ReferenceTab, number> = {
  modes: new Set(Object.values(MODE_GROUP_HUE)).size,
  schemas: Object.keys(DOMAIN_HUE).length,
  needs: Object.keys(NEED_HUE).length,
  techniques: TECHNIQUE_GROUPS.length,
  concerns: ref.concerns.flatMap((g) => g.items).length,
  path: PHASE_LOOK_KEYS.length,
  practice: PRACTICE_GROUPS.length,
};

describe('справочник: на вкладке листы разного оттенка и со знаком', () => {
  it.each(REFERENCE_TABS.map((t) => t.id))('вкладка %s', (tab) => {
    expect(tabSheets(ref[tab]).length, tab).toBeGreaterThan(0);
    expect(tabLookProblems(ref[tab], SEMANTIC_GROUPS[tab])).toEqual([]);
  });

  it('оттенков нужно по числу смысловых групп, не меньше трёх; на короткой вкладке — по числу листов', () => {
    expect([huesNeeded(20, 6), huesNeeded(8, 1), huesNeeded(2, 2), huesNeeded(1, 5)]).toEqual([6, 3, 2, 1]);
  });

  const sheet = (id: string, hue: number, sign?: string) =>
    ({ kind: 'note', id, name: id, hue, sign }) as ReferenceGroup['items'][number];
  const tab = (items: ReferenceGroup['items']): ReferenceGroup[] => [{ key: 'g', look: { hue: PAPER_HUE.peach }, items }];

  it('красный образец: шесть листов на одной бумаге и лист без знака', () => {
    const flat = tab(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => sheet(id, PAPER_HUE.peach, id === 'f' ? undefined : 'talk')));
    expect(tabLookProblems(flat, 1)).toEqual(['оттенков 1, нужно не меньше 3', 'лист без знака: f']);
  });

  it('контрольный образец: три оттенка и знак у каждого — чисто; знак и бумага листа группы считаются', () => {
    const hues = [PAPER_HUE.peach, PAPER_HUE.sky, PAPER_HUE.moss];
    expect(tabLookProblems(tab(['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => sheet(id, hues[i % 3], 'talk'))), 3)).toEqual([]);
    const byGroup: ReferenceGroup[] = hues.map((hue, i) => ({
      key: `g${i}`, look: { hue, sign: 'talk' }, items: [{ kind: 'mode', id: `m${i}`, name: 'm' }],
    }));
    expect(tabLookProblems(byGroup, 3)).toEqual([]);
  });
});
