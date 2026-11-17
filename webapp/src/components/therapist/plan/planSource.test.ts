import { describe, it, expect } from 'vitest';
import * as guide from '../../../../../shared/src/schemaTherapy/guide';
import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { planSourceTitle } from './planSource';

const tr = (ty: string) => ty;

describe('planSourceTitle', () => {
  it('статья есть — её название; техника — по имени из библиотеки', () => {
    const modeId = guide.buildModeGuides(tr)[0].modeId;
    expect(planSourceTitle(guide, tr, { kind: 'mode', id: modeId, field: 'cognitive' })).toBe(getModeById(modeId)?.name);
    const technique = guide.buildTechniqueGuides(tr)[0];
    expect(planSourceTitle(guide, tr, { kind: 'technique', id: technique.id, field: 'steps' })).toBe(technique.name);
  });

  it('статьи нет, источника нет или тексты не приехали — ссылки нет', () => {
    expect(planSourceTitle(guide, tr, { kind: 'schema', id: 'removed_article', field: 'session' })).toBeNull();
    expect(planSourceTitle(guide, tr, null)).toBeNull();
    expect(planSourceTitle(undefined, tr, { kind: 'mode', id: 'x', field: 'goal' })).toBeNull();
  });
});
