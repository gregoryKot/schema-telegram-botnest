// Вкладка «Путь терапии»: условные фазы лентой по порядку (shared/…/guide/phases/). Одна раскрытая группа, её подпись и
// подсказка отвечают «что это и зачем»; обзор идёт первым без номера, фазы — с номерами; бумага — своя сирень.
import type { PhaseGuide, TechniqueGuide } from '../../../../shared/src/schemaTherapy/guide';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import { getModeById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { PAPER_HUE, type PaperHue, type SheetLook } from '../../../../shared/src/theme/entityLook';
import type { GuideLink } from '../../components/therapist/guide/GuideLinkRows';
import type { ReferenceGroup } from './guideReferenceModel';

export const PHASES_HUE: PaperHue = PAPER_HUE.lilac;
export const PHASE_LOOK: SheetLook = { hue: PHASES_HUE };
export const PHASES_TITLE = 'Фазы по порядку';
export const PHASES_HINT = 'Условная карта: фазы гибкие, клиент проходит их не по прямой и возвращается назад';
/** Обзорный лист пути: стоит первым и номера не получает. */
export const PHASE_OVERVIEW_ID = 'overview';

/** Номера листов по порядку: обзор — без номера, фазы — 1…N. */
export function phaseSteps(ids: readonly string[]): Map<string, number> {
  return new Map(ids.filter((id) => id !== PHASE_OVERVIEW_ID).map((id, i) => [id, i + 1]));
}

/** Подпись листа в шапке: «Фаза N», у обзора — имя вкладки. */
export const phaseLabel = (step: number | undefined): string => (step ? `Фаза ${step}` : 'Путь терапии');

/** Листы вкладки одной группой в порядке пути; пустую отсеет buildReference. */
export function phaseGroups(guides: PhaseGuide[]): ReferenceGroup[] {
  const steps = phaseSteps(guides.map((p) => p.id));
  return [{
    key: 'path', title: PHASES_TITLE, hint: PHASES_HINT, look: PHASE_LOOK,
    items: guides.map((p) => ({ kind: 'phase', id: p.id, name: p.name, sub: p.goal, step: steps.get(p.id) })),
  }];
}

/** Лист фазы с переходами: режимы, техники и заметки, у которых есть свой лист; соседние листы пути. */
export interface PhaseView {
  phase: PhaseGuide;
  step?: number;
  modes: GuideLink[];
  techniques: TechniqueGuide[];
  notes: GuideLink[];
  prev?: PhaseGuide;
  next?: PhaseGuide;
}

type PhaseTexts = Pick<Guide, 'buildModeGuides' | 'buildTechniqueGuides' | 'practiceNotes'>;
const pick = <T>(ids: readonly string[] | undefined, find: (id: string) => T | undefined): T[] =>
  (ids ?? []).flatMap((id) => find(id) ?? []);

/** Лист по id среди листов пути; такого нет — null. Ссылка без своего листа в справочнике выпадает. */
export function phaseView(texts: PhaseTexts, tr: Tr, phases: PhaseGuide[], id: string): PhaseView | null {
  const at = phases.findIndex((p) => p.id === id);
  if (at < 0) return null;
  const phase = phases[at];
  const modeGuides = texts.buildModeGuides(tr);
  const techniques = texts.buildTechniqueGuides(tr);
  const notes = texts.practiceNotes(tr);
  return {
    phase, step: phaseSteps(phases.map((p) => p.id)).get(id), prev: phases[at - 1], next: phases[at + 1],
    modes: pick(phase.modeIds, (modeId) => {
      const guide = modeGuides.find((g) => g.modeId === modeId);
      return guide && { id: modeId, name: getModeById(modeId)?.name ?? modeId, sub: guide.goal };
    }),
    techniques: pick(phase.techniques, (techniqueId) => techniques.find((t) => t.id === techniqueId)),
    notes: pick(phase.noteIds, (noteId) => {
      const note = notes.find((n) => n.id === noteId);
      return note && { id: note.id, name: note.title, sub: note.summary };
    }),
  };
}
