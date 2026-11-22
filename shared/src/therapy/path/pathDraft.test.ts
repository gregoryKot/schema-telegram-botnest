import { describe, expect, it } from 'vitest';
import { modeGuide, resolveAddress, schemaGuide, type TechniqueId } from '../../schemaTherapy/guide';
import { buildPathDraft, type DraftGuide, type PathDraftInput } from './pathDraft';
import { phaseDraftsFromTemplate } from './pathPlan';
import { pathTemplate } from './templates';
import { modeRef, techniqueRef } from './templates/types';

const tr = (ty: string) => ty;
const general = pathTemplate(tr, 'general')!;
/** Фазы общего шаблона: id 1..5 — assessment, bonding, change, autonomy, ending. */
const phases = phaseDraftsFromTemplate(general).map((d, i) => ({
  id: i + 1, position: i, templatePhaseId: d.templatePhaseId, endedAt: null as string | null,
}));
const MODE_TECHNIQUES: Record<string, TechniqueId[]> = {
  detached_protector: ['empathic_confrontation', 'chairwork'],
  punitive_critic: ['chairwork', 'flashcards'],
  vulnerable_child: ['imagery_rescripting'],
  healthy_adult: ['pattern_breaking'],
};
const guide: DraftGuide = {
  modeTechniques: (id) => MODE_TECHNIQUES[id] ?? [],
  schemaTechniques: (id) => (id === 'abandonment' ? ['imagery_rescripting', 'schema_diary'] : []),
};
const draft = (over: Partial<PathDraftInput> = {}) =>
  buildPathDraft({ phases, template: general, modeIds: [], schemaIds: [], planned: [], guide, ...over });
const addresses = (d: ReturnType<typeof draft>, phaseId: number) =>
  d.find((p) => p.phaseId === phaseId)?.items.map((i) => i.address) ?? [];

describe('buildPathDraft', () => {
  it('копинг встаёт в фазу связи, Критик и Ребёнок — в фазу изменений, в порядке работы с режимами', () => {
    const d = draft({ modeIds: ['vulnerable_child', 'punitive_critic', 'detached_protector'] });
    expect(addresses(d, 2)).toEqual([modeRef('detached_protector'), techniqueRef('empathic_confrontation')]);
    expect(addresses(d, 3)).toEqual([
      techniqueRef('chairwork'), modeRef('punitive_critic'), techniqueRef('flashcards'),
      modeRef('vulnerable_child'), techniqueRef('imagery_rescripting'),
    ]);
    expect(d.map((p) => p.phaseId)).toEqual([2, 3]);
  });

  it('техника, названная шаблоном в фазе, уходит в неё, а не в первую подходящую, и помечена типичной', () => {
    const d = draft({ modeIds: ['detached_protector'] });
    const chair = d.find((p) => p.phaseId === 3)!.items[0];
    expect(chair).toEqual({ address: techniqueRef('chairwork'), reasons: [{ kind: 'mode', id: 'detached_protector' }], typical: true });
  });

  it('одна техника от двух источников — одно предложение с обеими причинами', () => {
    const d = draft({ modeIds: ['vulnerable_child'], schemaIds: ['abandonment'] });
    const all = d.flatMap((p) => p.items);
    const resc = all.filter((i) => i.address === techniqueRef('imagery_rescripting'));
    expect(resc).toHaveLength(1);
    expect(resc[0].reasons).toEqual([{ kind: 'mode', id: 'vulnerable_child' }, { kind: 'schema', id: 'abandonment' }]);
  });

  it('Здоровый Взрослый идёт через весь курс: статья — в первой фазе, где её называет шаблон', () => {
    const d = draft({ modeIds: ['healthy_adult'] });
    expect(addresses(d, 2)).toEqual([modeRef('healthy_adult')]);
    expect(addresses(d, 4)).toEqual([techniqueRef('pattern_breaking')]);
  });

  it('уже стоящее в плане не предлагается — и по другому разделу той же статьи', () => {
    const d = draft({ modeIds: ['vulnerable_child'], planned: ['technique:imagery_rescripting/when', null] });
    expect(d.flatMap((p) => p.items.map((i) => i.address))).toEqual([modeRef('vulnerable_child')]);
  });

  it('закрытая фаза предложений не получает: работа уходит в следующую подходящую', () => {
    const closed = phases.map((p) => (p.id === 2 ? { ...p, endedAt: '2026-01-10' } : p));
    const d = draft({ phases: closed, modeIds: ['detached_protector'] });
    expect(addresses(d, 2)).toEqual([]);
    expect(addresses(d, 3)).toContain(modeRef('detached_protector'));
  });

  it('пусто: нет режимов и схем, путь без шаблона, свои фазы, неизвестный режим', () => {
    expect(draft()).toEqual([]);
    expect(draft({ template: null, modeIds: ['vulnerable_child'] })).toEqual([]);
    expect(draft({ phases: phases.map((p) => ({ ...p, templatePhaseId: null })), modeIds: ['vulnerable_child'] })).toEqual([]);
    expect(draft({ modeIds: ['no_such_mode'] })).toEqual([]);
  });

  it('на настоящем справочнике каждый адрес черновика ведёт в существующий раздел', () => {
    const real: DraftGuide = {
      modeTechniques: (id) => modeGuide(tr, id)?.techniques ?? [],
      schemaTechniques: (id) => schemaGuide(tr, id)?.guide.techniques ?? [],
    };
    const d = draft({ guide: real, modeIds: ['detached_protector', 'punitive_critic', 'vulnerable_child', 'healthy_adult'], schemaIds: ['abandonment', 'defectiveness'] });
    const all = d.flatMap((p) => p.items);
    expect(all.length).toBeGreaterThan(6);
    for (const item of all) expect(resolveAddress(item.address, tr), item.address).not.toBeNull();
  });
});
