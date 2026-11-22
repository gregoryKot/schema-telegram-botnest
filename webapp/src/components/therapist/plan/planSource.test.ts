import { describe, it, expect } from 'vitest';
import * as guide from '../../../../../shared/src/schemaTherapy/guide';
import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { planSourceLink } from './planSource';

const tr = (ty: string) => ty;
const own = { sourceAddress: null, source: null };

describe('planSourceLink', () => {
  it('сохранил адрес → нашёл раздел: статья и заголовок раздела, ссылка открывает статью', () => {
    const modeId = guide.buildModeGuides(tr)[0].modeId;
    expect(planSourceLink(guide, tr, { ...own, sourceAddress: `mode:${modeId}/cognitive` })).toEqual({
      title: `${getModeById(modeId)?.name} · ${guide.sectionTitle('mode', 'cognitive')}`, changed: false, open: { kind: 'mode', id: modeId },
    });
  });

  it('пункт до адресов: старый источник переводится в адрес', () => {
    const technique = guide.buildTechniqueGuides(tr)[0];
    const link = planSourceLink(guide, tr, { ...own, source: { kind: 'technique', id: technique.id, field: 'steps' } });
    expect(link?.open).toEqual({ kind: 'technique', id: technique.id });
    expect(link?.title.startsWith(`${technique.name} · `)).toBe(true);
  });

  it('раздела больше нет — заголовок по адресу и «раздел изменился», ссылки нет', () => {
    expect(planSourceLink(guide, tr, { ...own, sourceAddress: 'mode:removed_article/cognitive' })).toEqual({
      title: guide.sectionTitle('mode', 'cognitive'), changed: true, open: null,
    });
  });

  it('свой пункт или тексты не приехали — ссылки нет', () => {
    expect(planSourceLink(guide, tr, own)).toBeNull();
    expect(planSourceLink(undefined, tr, { ...own, sourceAddress: 'mode:x/goal' })).toBeNull();
  });
});
