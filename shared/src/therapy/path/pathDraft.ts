// Черновик пути из концептуализации (#1522): по режимам и схемам клиента — что обычно делают в каждой фазе.
// Детерминированно: техники берутся из разделов справочника, фаза — по порядку работы с режимами и шаблону.
import { MODE_GROUPS } from '../../schemaTherapy/content/modeGroups';
import type { TechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { PathPhase } from './pathModel';
import type { PathTemplate } from './templates';
import { modeRef, techniqueRef } from './templates/types';

/** Откуда предложение: режим или схема клиента, в разделе которых стоит техника. */
export interface DraftReason {
  kind: 'mode' | 'schema';
  id: string;
}

export interface PathDraftItem {
  /** Адрес раздела справочника — источник будущего пункта плана. */
  address: string;
  reasons: DraftReason[];
  /** Стоит в «обычно в этой фазе» шаблона пути. */
  typical: boolean;
}

export interface PathDraftPhase {
  phaseId: number;
  items: PathDraftItem[];
}

/** Техники «На сессии» разделов справочника; раздела нет — пустой список. */
export interface DraftGuide {
  modeTechniques: (modeId: string) => readonly TechniqueId[];
  schemaTechniques: (schemaId: string) => readonly TechniqueId[];
}

export interface PathDraftInput {
  phases: readonly Pick<PathPhase, 'id' | 'position' | 'templatePhaseId' | 'endedAt'>[];
  template: PathTemplate | null;
  modeIds: readonly string[];
  schemaIds: readonly string[];
  /** Адреса источников пунктов, уже стоящих в плане. */
  planned: readonly (string | null)[];
  guide: DraftGuide;
}

type Stage = 'coping' | 'critic' | 'child' | 'healthy' | 'schema';

// Порядок работы с режимами: обойти копинги → ответить Критику → дать Ребёнку недостающее; Здоровый Взрослый — весь курс.
const STAGE_ORDER: readonly Stage[] = ['coping', 'critic', 'child', 'healthy', 'schema'];
/** В каких фазах справочника (`guidePhaseIds` шаблона) идёт работа с группой. */
const STAGE_PHASES: Record<Stage, readonly string[]> = {
  coping: ['safety', 'awareness'],
  critic: ['managing', 'healing'],
  child: ['healing'],
  healthy: ['safety', 'awareness', 'managing', 'healing', 'autonomy'],
  schema: ['awareness', 'healing'],
};
const GROUP_STAGE: Record<string, Stage> = {
  coping_surrender: 'coping',
  coping_avoidance: 'coping',
  coping_overcompensation: 'coping',
  critic: 'critic',
  child: 'child',
  healthy: 'healthy',
};

const MODE_STAGE = new Map<string, Stage>(
  MODE_GROUPS.flatMap((g) => {
    const stage = GROUP_STAGE[g.id];
    return stage ? g.items.map((m) => [m.id, stage] as const) : [];
  }),
);

/** Статья адреса без раздела: техника в плане из любого её раздела считается добавленной. */
const articleOf = (address: string) => address.split('/')[0];

/**
 * Предложения по фазам пути. Каждая статья предлагается один раз: в фазе, где она названа шаблоном,
 * иначе в первой незакрытой фазе её этапа. Фазы без шаблона и закрытые фазы предложений не получают.
 */
export function buildPathDraft(input: PathDraftInput): PathDraftPhase[] {
  const { template, guide } = input;
  const open = [...input.phases]
    .filter((p) => !p.endedAt)
    .sort((a, b) => a.position - b.position)
    .flatMap((p) => {
      const tpl = template?.phases.find((t) => t.id === p.templatePhaseId);
      return tpl ? [{ id: p.id, tpl, typical: new Set(tpl.recommended.map(articleOf)) }] : [];
    });
  if (open.length === 0) return [];

  const planned = new Set(input.planned.flatMap((a) => (a ? [articleOf(a)] : [])));
  const sources = [
    ...input.modeIds.flatMap((id) => {
      const stage = MODE_STAGE.get(id);
      return stage ? [{ reason: { kind: 'mode' as const, id }, stage, addresses: [modeRef(id), ...guide.modeTechniques(id).map(techniqueRef)] }] : [];
    }),
    ...input.schemaIds.map((id) => ({
      reason: { kind: 'schema' as const, id }, stage: 'schema' as Stage, addresses: guide.schemaTechniques(id).map(techniqueRef),
    })),
  ].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const byArticle = new Map<string, PathDraftItem>();
  const byPhase = new Map<number, PathDraftItem[]>();
  for (const src of sources) {
    const fits = open.filter((p) => p.tpl.guidePhaseIds.some((g) => STAGE_PHASES[src.stage].includes(g)));
    for (const address of src.addresses) {
      const article = articleOf(address);
      if (planned.has(article)) continue;
      const known = byArticle.get(article);
      if (known) {
        known.reasons.push(src.reason);
        continue;
      }
      const phase = fits.find((p) => p.typical.has(article)) ?? fits[0];
      if (!phase) continue;
      const item = { address, reasons: [src.reason], typical: phase.typical.has(article) };
      byArticle.set(article, item);
      byPhase.set(phase.id, [...(byPhase.get(phase.id) ?? []), item]);
    }
  }
  return open.flatMap((p) => {
    const items = byPhase.get(p.id);
    return items ? [{ phaseId: p.id, items }] : [];
  });
}
