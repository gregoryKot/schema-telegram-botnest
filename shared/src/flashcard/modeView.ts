// Подпись и группа режима карточки «Мне плохо» — для плиток шага 1, итога «Сохранено» и
// «Истории карточек» (одна функция на все три места, правило №3). Свои четыре режима карточки
// (buildModes) — со своими подписями; группа задаёт бумагу и знак (modeLook, entityLook.ts).
// Карточка с сервера может нести любой из 35 режимов (терапевт, старый мини-апп): подпись — из
// общего словаря MODE_GROUPS, а не сырой id «punitive_critic» (аудит 2026-11, FlashcardHistory
// показывал `?? card.mode`); неизвестный id — без подписи, экран не выдумывает режим.
import { getModeById } from '../schemaTherapy/schemaTherapyData';
import type { ModeData } from './types';

/** Группа (id из MODE_GROUPS) каждого режима карточки: «Отстранённый Защитник» — избегание. */
export const FLASHCARD_MODE_GROUP: Readonly<Record<string, string>> = {
  vulnerable_child: 'child',
  angry_child: 'child',
  detached: 'coping_avoidance',
  critic: 'critic',
};

export interface FlashcardModeView {
  /** Подпись режима; null — режим не узнан (данных нет — подписи нет). */
  label: string | null;
  /** Группа режима для бумаги и знака; undefined — общий вид «режимы вообще». */
  groupId: string | undefined;
}

export function flashcardModeView(
  modeId: string,
  modes: readonly ModeData[],
): FlashcardModeView {
  const own = modes.find((m) => m.id === modeId);
  if (own) return { label: own.label, groupId: FLASHCARD_MODE_GROUP[modeId] };
  const any = getModeById(modeId);
  return any
    ? { label: any.name, groupId: any.groupId }
    : { label: null, groupId: undefined };
}
