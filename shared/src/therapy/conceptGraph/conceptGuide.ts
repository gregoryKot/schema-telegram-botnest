/**
 * Подсказки терапевту в схеме случая (#995): раздел режима вместе с техниками
 * из библиотеки. Читают плашка «Обычно в методе» (ConceptGuideHint) и листы
 * сайта (webapp/src/components/therapist/guide/). Тексты разделов —
 * shared/src/schemaTherapy/guide/.
 */
import { useMemo } from 'react';
import type {
  BetweenSessionsItem,
  ModeGuide,
  TechniqueGuide,
  TechniqueId,
} from '../../schemaTherapy/guide';
import type { Tr } from '../../needs/types';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { useGuide, type Guide } from './guideLoader';

/**
 * Что сайт умеет вокруг плашки. Без пропа плашка — только текст; без
 * onAssign (справочник без клиента) — без «Дать заданием».
 */
export interface ConceptGuideActions {
  /** «Подробнее» — лист режима. */
  onOpenMode: (modeId: string) => void;
  /** Техника «На сессии» — лист техники. */
  onOpenTechnique: (techniqueId: TechniqueId, modeId: string) => void;
  /** «Дать заданием» у пункта «Между сессиями». */
  onAssign?: (item: BetweenSessionsItem, modeId: string) => void;
}

export interface ModeGuideView {
  guide: ModeGuide;
  /** Техники «На сессии» в порядке раздела; id без статьи в библиотеке пропускается. */
  techniques: TechniqueGuide[];
}

/** Раздел режима с техниками; null — своего раздела нет (свой режим терапевта). */
export function resolveModeGuide(
  texts: Pick<Guide, 'modeGuide' | 'buildTechniqueGuides'>,
  tr: Tr,
  modeId: string,
): ModeGuideView | null {
  const guide = texts.modeGuide(tr, modeId);
  if (!guide) return null;
  const library = new Map(texts.buildTechniqueGuides(tr).map((t) => [t.id, t]));
  const techniques = guide.techniques.flatMap((id) => library.get(id) ?? []);
  return { guide, techniques };
}

/**
 * resolveModeGuide в форме обращения пользователя. undefined — тексты ещё
 * грузятся (guideLoader), null — раздела нет или тексты не загрузились.
 */
export function useModeGuide(modeId: string): ModeGuideView | null | undefined {
  const form = useAddressForm();
  const texts = useGuide();
  return useMemo(
    () =>
      texts &&
      resolveModeGuide(texts, (ty, vy) => pickForm(form, ty, vy), modeId),
    [texts, form, modeId],
  );
}
