import { useState } from 'react';
import { api, type UserId } from '../../../api';
import { sameId } from '../../../../../shared/src/utils/sameId';

interface Override { clientId: UserId; at: string | null }

/**
 * Тумблер «Показать клиенту» вкладки «Концептуализация»: положение берётся с
 * сервера (GET концептуализации несёт `sharedWithClientAt`), после нажатия — из
 * ответа PATCH. Ответ помнится вместе с id клиента: поздний ответ не переносит
 * положение на карточку другого клиента. Отказ — `failed`, положение прежнее.
 * Событие — литералом: так его видит трипваер analytics-sync (src/security).
 */
export function useConceptShare(clientId: UserId | undefined, serverAt: string | null | undefined) {
  const [override, setOverride] = useState<Override | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const own = override && clientId != null && sameId(override.clientId, clientId);
  const sharedAt = own ? override.at : (serverAt ?? null);

  async function toggle() {
    if (clientId == null || busy) return;
    const next = !sharedAt;
    setBusy(true);
    setFailed(false);
    try {
      const res = await api.shareConceptualization(clientId, next);
      setOverride({ clientId, at: res.sharedWithClientAt });
      api.trackEvent('concept_shared', { on: next });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { shared: sharedAt != null, sharedAt, busy, failed, toggle };
}
