// Вид листов подсказок и групп «Справочника» терапевта: бумага и знак — те же, что у клиента
// (entityLook.ts): режим — бумага его группы и знак группы или свой, схема — бумага и знак домена.
// Техника и раздел «Для терапевта» — бумага своей группы (канал метода, раздел), знак — свой
// (guideSignsModel.ts): на вкладке листы разных групп разного оттенка (guideReferenceHues.test.ts).
import type { PracticeGroupId, PracticeNote, TechniqueGroupId, TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import {
  PAPER_HUE, domainLook, modeLook, type PaperHue, type SheetLook,
} from '../../../../../shared/src/theme/entityLook';
import { getModeById, getSchemaById } from '../../../schemaTherapyData';
import { practiceNoteSign, TECHNIQUE_SIGN } from '../../art/guideSignsModel';

/** Нейтральная бумага листа без своей группы (персик). */
export const TECHNIQUES_HUE: PaperHue = PAPER_HUE.peach;

/** Группа техник → оттенок: отношения — тёплая глина, понимание — небо, чувства — слива, жизнь — мох. */
export const TECHNIQUE_GROUP_HUE: Record<TechniqueGroupId, PaperHue> = {
  relationship: PAPER_HUE.clay,
  cognitive: PAPER_HUE.sky,
  experiential: PAPER_HUE.plum,
  behavioral: PAPER_HUE.moss,
  formulation: PAPER_HUE.straw,
  borrowed: PAPER_HUE.teal,
};

/** Раздел «Для терапевта» → оттенок; «Терапевт и формат» остаётся на небе кабинета. */
export const PRACTICE_GROUP_HUE: Record<PracticeGroupId, PaperHue> = {
  start: PAPER_HUE.straw,
  stuck: PAPER_HUE.clay,
  hard: PAPER_HUE.plum,
  therapist: PAPER_HUE.sky,
  method: PAPER_HUE.moss,
};

/** Режим: бумага группы, знак — свой («Сердитый Ребёнок» — Flare) или группы; режим без группы — общий вид режимов. */
export const modeGuideLook = (modeId: string): SheetLook => modeLook(modeId, getModeById(modeId)?.groupId);

/** Схема: бумага и знак домена; неизвестная схема — null (лист без картинки). */
export const schemaGuideLook = (schemaId: string): SheetLook | null => domainLook(getSchemaById(schemaId)?.domainId ?? '');

export const techniqueGuideLook = (t: Pick<TechniqueGuide, 'id' | 'group'>): SheetLook => ({
  hue: TECHNIQUE_GROUP_HUE[t.group] ?? TECHNIQUES_HUE, sign: TECHNIQUE_SIGN[t.id],
});

export const practiceNoteLook = (n: Pick<PracticeNote, 'id' | 'group'>): SheetLook => ({
  hue: PRACTICE_GROUP_HUE[n.group] ?? PAPER_HUE.sky, sign: practiceNoteSign(n.id) ?? undefined,
});
