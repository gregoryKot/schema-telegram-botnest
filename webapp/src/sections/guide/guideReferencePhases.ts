// Вкладка «Путь терапии»: условные фазы лентой по порядку, за ней сквозные темы и шаблоны пути (shared/…/guide/phases/). Подпись и
// подсказка группы отвечают «что это и зачем»; обзор идёт первым без номера, фазы — с номерами. Каждый лист — своя бумага
// и свой знак (pathSheetLook, shared/src/theme/pathLook.ts): стадии идут по кругу палитры, как путь.
import type { PathSheetGroupId, PhaseGuide, TechniqueGuide } from '../../../../shared/src/schemaTherapy/guide';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import { getModeById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { PAPER_HUE, type SheetLook } from '../../../../shared/src/theme/entityLook';
import { pathSheetLook } from '../../../../shared/src/theme/pathLook';
import type { GuideLink } from '../../components/therapist/guide/GuideLinkRows';
import type { ReferenceGroup } from './guideReferenceModel';

/** Группа без своей бумаги: каждая строка — карточка оттенка своего листа. */
const GROUP_LOOK: SheetLook = { hue: PAPER_HUE.lilac };
export const PHASES_TITLE = 'Фазы по порядку';
export const PHASES_HINT = 'Условная карта: фазы гибкие, клиент проходит их не по прямой и возвращается назад';
/** Обзорный лист пути: стоит первым и номера не получает. */
export const PHASE_OVERVIEW_ID = 'overview';

/** Группы вкладки в порядке показа: подпись и подсказка «что это и зачем». */
export const PATH_GROUPS: readonly { id: PathSheetGroupId; title: string; hint: string; label: string }[] = [
  { id: 'path', title: PHASES_TITLE, hint: PHASES_HINT, label: 'Путь терапии' },
  { id: 'topics', title: 'Сквозные темы', hint: 'Что идёт через все фазы: порядок режимов, техники, сессия, прогресс и застревание', label: 'Путь терапии' },
  { id: 'templates', title: 'Шаблоны пути', hint: 'Готовые раскладки фаз по неделям: из протоколов исследований и сводной карты', label: 'Шаблон пути' },
];
const groupOf = (p: PhaseGuide): PathSheetGroupId => p.group ?? 'path';

/** Номера листов ленты по порядку: обзор — без номера, фазы — 1…N; листы других групп номера не получают. */
export function phaseSteps(guides: readonly Pick<PhaseGuide, 'id' | 'group'>[]): Map<string, number> {
  const ids = guides.filter((p) => (p.group ?? 'path') === 'path' && p.id !== PHASE_OVERVIEW_ID).map((p) => p.id);
  return new Map(ids.map((id, i) => [id, i + 1]));
}

/** Подпись листа в шапке: «Фаза N», у обзора — имя вкладки, у шаблона — «Шаблон пути». */
export const phaseLabel = (step: number | undefined, group: PathSheetGroupId = 'path'): string =>
  step ? `Фаза ${step}` : PATH_GROUPS.find((g) => g.id === group)?.label ?? 'Путь терапии';

/** Листы вкладки группами: лента фаз в порядке пути, сквозные темы, шаблоны; пустую отсеет buildReference. */
export function phaseGroups(guides: PhaseGuide[]): ReferenceGroup[] {
  const steps = phaseSteps(guides);
  return PATH_GROUPS.map((g) => ({
    key: g.id, title: g.title, hint: g.hint, look: GROUP_LOOK,
    items: guides.filter((p) => groupOf(p) === g.id).map((p) => {
      const look = pathSheetLook(p.id);
      return { kind: 'phase' as const, id: p.id, name: p.name, sub: p.goal, step: steps.get(p.id), sign: look.sign, hue: look.hue };
    }),
  }));
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

/** Лист по id среди листов вкладки; такого нет — null. Ссылка без своего листа в справочнике выпадает; соседи — из той же группы. */
export function phaseView(texts: PhaseTexts, tr: Tr, all: PhaseGuide[], id: string): PhaseView | null {
  const found = all.find((p) => p.id === id);
  if (!found) return null;
  const phases = all.filter((p) => groupOf(p) === groupOf(found));
  const at = phases.indexOf(found);
  const phase = found;
  const modeGuides = texts.buildModeGuides(tr);
  const techniques = texts.buildTechniqueGuides(tr);
  const notes = texts.practiceNotes(tr);
  return {
    phase, step: phaseSteps(all).get(id), prev: phases[at - 1], next: phases[at + 1],
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
