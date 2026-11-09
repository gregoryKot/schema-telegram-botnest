import type { EntityId, PaperHue, SignKey } from '../../../../../shared/src/theme/entityLook';
import { modeLookById } from '../modeLookById';
import { pebblesLaid } from '../../art/paper';
import { QUICK_TAG_ENTITY, type QuickSaved } from './quickEntryModel';

/** Вид листа «Записано»: сущность записи, своя бумага и сцена из данных, если они есть. */
export interface QuickDoneView {
  entity: EntityId;
  /** Бумага листа, если у записи она своя (режим — бумага его группы). */
  hue?: PaperHue;
  /** Знак в сцене «готово» (Sprout) вместо знака сущности — знак группы выбранного режима. */
  sprout?: SignKey;
  /** Сколько камешков легло — пункты благодарности за день (до трёх), только реальные. */
  pebbles?: number;
}

/**
 * Лист «Записано» по типу записи (docs/design/APP_2026-11.md, b10a, таблица ENTITY_LOOK): мысль —
 * камешек лёг на персике, схема — Sprout с Layers на глине, режим — Sprout со знаком его группы
 * на бумаге группы, благодарность — камешки на бирюзе, легло столько, сколько пунктов за день.
 * Нет данных (мастер «Заполнить подробно» их не отдаёт) — сцена сущности по умолчанию.
 */
export function quickDoneView(saved: QuickSaved): QuickDoneView {
  const entity = QUICK_TAG_ENTITY[saved.tag];
  if (saved.tag === 'mode' && saved.modeId) {
    const look = modeLookById(saved.modeId);
    return { entity, hue: look.hue, sprout: look.sign };
  }
  if (saved.tag === 'gratitude' && saved.gratitudeCount !== undefined) {
    return { entity, pebbles: pebblesLaid(saved.gratitudeCount) };
  }
  return { entity };
}
