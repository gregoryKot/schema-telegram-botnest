// Лист «Предложить по концептуализации» (#1522): предложения shared/pathDraft с названиями, подписью «откуда»
// и текстом будущего пункта. Чистая сборка: тексты справочника приходят аргументом.
import type { Tr } from '../../../../../../shared/src/schemaTherapy/guide/types';
import { getModeById, getSchemaById } from '../../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { Guide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { buildPathDraft, type DraftReason } from '../../../../../../shared/src/therapy/path/pathDraft';
import type { TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import type { PathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import { planItemAddress } from '../../../../../../shared/src/therapy/plan/planAddress';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import type { PlanSourceLink } from '../planSource';

export interface DraftRow {
  address: string;
  phaseId: number;
  /** Название статьи справочника — оно же текст пункта плана. */
  title: string;
  /** «режим Отстранённый Защитник → техника». */
  why: string;
  typical: boolean;
  open: NonNullable<PlanSourceLink['open']>;
}

export interface DraftGroup {
  phaseId: number;
  phaseName: string;
  rows: DraftRow[];
}

export interface DraftSource {
  path: TherapyPath;
  template: PathTemplate | null;
  modeIds: readonly string[];
  schemaIds: readonly string[];
  items: readonly PlanItem[];
}

/** Почему лист пуст; null — предложения есть. */
export type DraftEmpty = 'no-concept' | 'no-template' | 'nothing' | null;

const reasonLabel = (r: DraftReason) =>
  r.kind === 'mode' ? `режим ${getModeById(r.id)?.name ?? r.id}` : `схема ${getSchemaById(r.id)?.name ?? r.id}`;

/** Предложения по фазам; адрес без раздела в справочнике пропускается. */
export function pathDraftView(guide: Guide, tr: Tr, src: DraftSource): DraftGroup[] {
  const draft = buildPathDraft({
    phases: src.path.phases, template: src.template, modeIds: src.modeIds, schemaIds: src.schemaIds,
    planned: src.items.map((i) => planItemAddress(i)),
    guide: {
      modeTechniques: (id) => guide.modeGuide(tr, id)?.techniques ?? [],
      schemaTechniques: (id) => guide.schemaGuide(tr, id)?.guide.techniques ?? [],
    },
  });
  return draft.flatMap((group) => {
    const rows = group.items.flatMap((item): DraftRow[] => {
      const found = guide.resolveAddress(item.address, tr);
      if (!found || (found.kind !== 'mode' && found.kind !== 'technique')) return [];
      // статья самого режима: причина — он сам, стрелка вела бы к тому же названию
      const own = found.kind === 'mode';
      const why = item.reasons.map(reasonLabel).join(', ') + (own ? ' → статья режима' : ' → техника');
      return [{
        address: found.address, phaseId: group.phaseId, title: found.articleTitle, why, typical: item.typical,
        open: { kind: found.kind, id: found.articleId },
      }];
    });
    const phase = src.path.phases.find((p) => p.id === group.phaseId);
    return rows.length && phase ? [{ phaseId: group.phaseId, phaseName: phase.name, rows }] : [];
  });
}

export function draftEmpty(groups: readonly DraftGroup[], src: DraftSource): DraftEmpty {
  if (groups.length) return null;
  if (src.modeIds.length + src.schemaIds.length === 0) return 'no-concept';
  const tplIds = new Set(src.template?.phases.map((p) => p.id));
  if (!src.path.phases.some((p) => p.templatePhaseId && tplIds.has(p.templatePhaseId))) return 'no-template';
  return 'nothing';
}
