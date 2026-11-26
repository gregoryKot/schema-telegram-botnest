// Вид режима и потребности карточки «Мне плохо» (редизайн 2026-11, b12): бумага и знак берутся
// из ENTITY_LOOK (modeLook — группа режима, needLook — потребность), а не из своей таблицы оттенков.
// Режим сохранённой карточки может быть любым из 35 (flashcardModeView) — группу тогда передаёт
// вызывающий; неизвестная потребность — без вида (знак не выдумывается).
import { modeLook, needLook, type Look, type ModeLook, type SignKey } from '../../../../shared/src/theme/entityLook';
import { NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { FLASHCARD_MODE_GROUP, flashcardModeView } from '../../../../shared/src/flashcard/modeView';
import type { ModeData, NeedData } from '../../../../shared/src/flashcard/types';
import type { NeedId } from '../../../../shared/src/needs/types';

/** Вид режима: группа — своя у режима карточки или переданная (режим из общего словаря). */
export function flashcardModeLook(modeId: string, groupId?: string): ModeLook {
  return modeLook(modeId, groupId ?? FLASHCARD_MODE_GROUP[modeId]);
}

/** Вид потребности по id; id не из пяти потребностей — null. */
export function flashcardNeedLook(needId: string): Look | null {
  return Object.hasOwn(NEED_HUE, needId) ? needLook(needId as NeedId) : null;
}

export interface SummaryPart { label: string; sign?: SignKey }
export interface FlashcardSummaryParts { mode: SummaryPart | null; need: SummaryPart | null }

/** Режим и потребность карточки для итога, просмотра и строки истории: подпись и знак. Режим не
 *  узнан — null (сырой id не показывается), потребность не из списка — null. */
export function flashcardSummary(
  card: { mode: string; needId: string },
  modes: readonly ModeData[],
  needs: readonly NeedData[],
): FlashcardSummaryParts {
  const view = flashcardModeView(card.mode, modes);
  const need = needs.find((n) => n.id === card.needId);
  return {
    mode: view.label ? { label: view.label, sign: flashcardModeLook(card.mode, view.groupId).sign } : null,
    need: need ? { label: need.label, sign: flashcardNeedLook(need.id)?.sign } : null,
  };
}

/** Заголовок строки истории: «Режим · Потребность», без пустых частей. */
export function flashcardTitle({ mode, need }: FlashcardSummaryParts): string {
  return [mode?.label, need?.label].filter(Boolean).join(' · ');
}
