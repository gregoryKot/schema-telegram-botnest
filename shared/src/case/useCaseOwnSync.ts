import { useEffect } from 'react';
import type { CaseFlowFields } from './caseFlowTypes';

/**
 * «Своё» на шагах тела/порыва — поле видно всегда (фидбек владельца
 * 2026-08-31: «по умолчанию поле ввода, а снизу варианты»), чипы `*_own`
 * («Своё…») на экране больше не рендерятся. Признак «своё выбрано» —
 * непустой bodyOwn/impulseOwn; id `*_own` в selectedIds поддерживается
 * автосинхронизацией, потому что дальше по потоку (caseFlowMappers.chipLabels
 * → caseRecognition.joinTraitLabels) own-текст подставляется именно по этому
 * id. Инвариант живёт в хуке состояния, а не в UI (CLAUDE.md,
 * read-after-write): ни один экран не может набрать «своё» мимо выбора.
 */

export const isOwnChipId = (id: string): boolean => id.endsWith('_own');

/** Телесный own-чип привязан к воротам (`fear_own`, `sad_own`, …). */
export const ownChipIdForGate = (gateId: string | null): string =>
  `${gateId ?? 'unknown'}_own`;

export const IMPULSE_OWN_ID = 'impulse_own';

/** Тапнутые чипы — без own: лимит выбора (2 у тела, 3 у порыва) относится
 *  только к ним, свой текст слот не занимает. */
export const tappedChipIds = (ids: string[]): string[] =>
  ids.filter((id) => !isOwnChipId(id));

/**
 * Тап по чипу: снятие — всегда, добавление — пока тапнутых меньше limit.
 * null = лимит исчерпан (вызывающий даёт haptic.warning). own-хвост держится
 * последним — в приметах own-текст читается после готовых меток.
 */
export function toggleTappedChip(
  ids: string[],
  id: string,
  limit: number,
): string[] | null {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  const tapped = tappedChipIds(ids);
  if (tapped.length >= limit) return null;
  return [...tapped, id, ...ids.filter(isOwnChipId)];
}

/**
 * Согласует own-id с текстом: непустой текст — ровно один ownId (последним),
 * пустой — ни одного. null = уже согласовано (эффект не делает setState).
 * Смена ворот тоже проходит здесь: `fear_own` заменяется на `sad_own`, иначе
 * набранный текст молча пропадал бы из примет при выборе других ворот.
 */
export function syncOwnChipId(
  ids: string[],
  ownId: string,
  ownText: string,
): string[] | null {
  const owns = ids.filter(isOwnChipId);
  const wanted = ownText.trim() ? [ownId] : [];
  if (owns.length === wanted.length && owns[0] === wanted[0]) return null;
  return [...tappedChipIds(ids), ...wanted];
}

/**
 * Эффекты автосинхронизации. Сознательно без массива зависимостей: проверка
 * «уже согласовано» делает лишние прогоны бесплатными, а пропущенных не
 * бывает по построению (в т.ч. на восстановленном черновике и при смене
 * ворот). Порыв идёт через applyImpulseIds — тем же путём, что
 * toggleImpulseChip, с пересчётом suggestSecondDoor.
 */
export function useCaseOwnSync(
  fields: CaseFlowFields,
  patch: (p: Partial<CaseFlowFields>) => void,
  applyImpulseIds: (ids: string[]) => void,
) {
  useEffect(() => {
    const next = syncOwnChipId(
      fields.bodyChipIds,
      ownChipIdForGate(fields.gateId),
      fields.bodyOwn,
    );
    if (next) patch({ bodyChipIds: next });
  });
  useEffect(() => {
    const next = syncOwnChipId(
      fields.impulseChipIds,
      IMPULSE_OWN_ID,
      fields.impulseOwn,
    );
    if (next) applyImpulseIds(next);
  });
}
