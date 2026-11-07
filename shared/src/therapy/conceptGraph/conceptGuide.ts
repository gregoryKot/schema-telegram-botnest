/**
 * Подсказки терапевту в схеме случая (#995): раздел режима или схемы вместе с
 * техниками из библиотеки. Читают плашка «Обычно в методе» (ConceptGuideHint)
 * и листы сайта (webapp/src/components/therapist/guide/). Тексты разделов —
 * shared/src/schemaTherapy/guide/.
 */
import { useMemo } from 'react';
import type {
  BetweenSessionsItem,
  ModeGuide,
  SchemaGuide,
  TechniqueGuide,
  TechniqueId,
} from '../../schemaTherapy/guide';
import type { Tr } from '../../needs/types';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { useGuide, type Guide } from './guideLoader';
import type { GuideTask } from './guideHistory';

/** Чей раздел: режима или схемы. Откуда пришёл пункт плашки или листа. */
export interface GuideFrom {
  kind: 'mode' | 'schema';
  id: string;
}

/**
 * Что сайт умеет вокруг плашки. Без пропа плашка — только текст; без
 * onAssign (справочник без клиента) — без «Дать заданием».
 */
export interface ConceptGuideActions {
  /** «Подробнее о режиме» — лист режима. */
  onOpenMode: (modeId: string) => void;
  /** «Подробнее о схеме» — лист схемы. */
  onOpenSchema: (schemaId: string) => void;
  /** Техника «На сессии» — лист техники; без from — из списка техник «Справочника», вне раздела. */
  onOpenTechnique: (techniqueId: TechniqueId, from?: GuideFrom) => void;
  /** «Дать заданием» у пункта «Между сессиями». */
  onAssign?: (item: BetweenSessionsItem, from: GuideFrom) => void;
  /** Задания клиента — строки «давали …» (guideHistory.ts); нет — без истории. */
  tasks?: readonly GuideTask[];
}

/** Общее у разделов режима и схемы — то, что видно на плашке «Обычно в методе». */
export interface GuideHintView {
  guide: Pick<ModeGuide | SchemaGuide, 'goal' | 'betweenSessions'>;
  /** Техники «На сессии» в порядке раздела; id без статьи в библиотеке пропускается. */
  techniques: TechniqueGuide[];
}

export interface ModeGuideView extends GuideHintView {
  guide: ModeGuide;
}

export interface SchemaGuideView extends GuideHintView {
  guide: SchemaGuide;
  /** «Общее для домена» схемы. */
  domainNote: string;
}

type TechniqueTexts = Pick<Guide, 'buildTechniqueGuides'>;

function pickTechniques(
  texts: TechniqueTexts,
  tr: Tr,
  ids: TechniqueId[],
): TechniqueGuide[] {
  const library = new Map(texts.buildTechniqueGuides(tr).map((t) => [t.id, t]));
  return ids.flatMap((id) => library.get(id) ?? []);
}

/** Раздел режима с техниками; null — своего раздела нет (свой режим терапевта). */
export function resolveModeGuide(
  texts: Pick<Guide, 'modeGuide'> & TechniqueTexts,
  tr: Tr,
  modeId: string,
): ModeGuideView | null {
  const guide = texts.modeGuide(tr, modeId);
  if (!guide) return null;
  return { guide, techniques: pickTechniques(texts, tr, guide.techniques) };
}

/** Раздел схемы с «общим для домена» и техниками; null — раздела нет. */
export function resolveSchemaGuide(
  texts: Pick<Guide, 'schemaGuide'> & TechniqueTexts,
  tr: Tr,
  schemaId: string,
): SchemaGuideView | null {
  const found = texts.schemaGuide(tr, schemaId);
  if (!found) return null;
  const { guide, domainNote } = found;
  return {
    guide,
    domainNote,
    techniques: pickTechniques(texts, tr, guide.techniques),
  };
}

/**
 * Раздел в форме обращения пользователя. undefined — тексты ещё грузятся
 * (guideLoader), null — раздела нет, id пуст (лист закрыт) или тексты не
 * загрузились.
 */
function useResolved<T>(
  resolve: (texts: Guide, tr: Tr, id: string) => T | null,
  id: string,
): T | null | undefined {
  const form = useAddressForm();
  const texts = useGuide();
  return useMemo(
    () =>
      texts &&
      (id ? resolve(texts, (ty, vy) => pickForm(form, ty, vy), id) : null),
    [resolve, texts, form, id],
  );
}

/** resolveModeGuide в форме обращения пользователя (useResolved). */
export function useModeGuide(modeId: string): ModeGuideView | null | undefined {
  return useResolved(resolveModeGuide, modeId);
}

/** resolveSchemaGuide в форме обращения пользователя (useResolved). */
export function useSchemaGuide(
  schemaId: string,
): SchemaGuideView | null | undefined {
  return useResolved(resolveSchemaGuide, schemaId);
}
