// Вид листов подсказок и групп «Справочника» терапевта (редизайн 2026-11, b35): бумага и знак —
// те же, что у клиента (entityLook.ts): режим — бумага его группы (MODE_GROUP_HUE) и знак группы
// или свой, схема — бумага и знак домена (DOMAIN_HUE). У техник и разделов «Для терапевта» групп
// нет: техники лежат на персике (бумага реплики «Как это звучит», с которой лист техники и
// пришёл), «Для терапевта» — на небе кабинета (ENTITY_LOOK.therapist). Знак — свой у каждой
// техники и раздела (guideSignsModel.ts); раздел без знака — без картинки.
import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import {
  ENTITY_LOOK, PAPER_HUE, domainLook, modeLook, type PaperHue, type SheetLook,
} from '../../../../../shared/src/theme/entityLook';
import { getModeById, getSchemaById } from '../../../schemaTherapyData';
import { practiceNoteSign, TECHNIQUE_SIGN } from '../../art/guideSignsModel';

export const TECHNIQUES_HUE: PaperHue = PAPER_HUE.peach;
export const PRACTICE_HUE: PaperHue = ENTITY_LOOK.therapist.hue;

/** Режим: бумага группы, знак — свой («Сердитый Ребёнок» — Flare) или группы; режим без группы — общий вид режимов. */
export const modeGuideLook = (modeId: string): SheetLook => modeLook(modeId, getModeById(modeId)?.groupId);

/** Схема: бумага и знак домена; неизвестная схема — null (лист без картинки). */
export const schemaGuideLook = (schemaId: string): SheetLook | null => domainLook(getSchemaById(schemaId)?.domainId ?? '');

export const techniqueGuideLook = (id: TechniqueId): SheetLook => ({ hue: TECHNIQUES_HUE, sign: TECHNIQUE_SIGN[id] });

export const practiceNoteLook = (noteId: string): SheetLook => ({ hue: PRACTICE_HUE, sign: practiceNoteSign(noteId) ?? undefined });
