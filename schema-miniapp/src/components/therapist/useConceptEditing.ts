import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type {
  TherapyClientSummary,
  ClientConceptualization,
  UserId,
} from '../../api';
import { conceptSaveBody } from '../../../../shared/src/therapy/conceptGraph/conceptSaveBody';
import {
  conceptOverLimitField,
  conceptOverLimitText,
} from '../../../../shared/src/therapy/conceptOverLimit';
import { sameId } from '../../../../shared/src/utils/sameId';

// Состояние и обработчики концептуализации клиента. Вынесено из
// useClientDetail.ts (правило №10); публичная форма возврата хука-фасада
// не изменилась. Инцидент 2026-10-26 (docs/INCIDENTS.md): ответ сохранения,
// пришедший после перехода к другому клиенту, писался в ЕГО карточку —
// следующее «Сохранить» отправило бы концептуализацию прежнего клиента новому.
export function useConceptEditing(
  selectedClient: TherapyClientSummary | null,
  openClientIdRef: { readonly current: UserId | null },
) {
  const tr = useTr();
  const [concept, setConcept] = useState<ClientConceptualization | null>(null);
  const [localConcept, setLocalConcept] = useState<
    Partial<ClientConceptualization>
  >({});
  const [conceptDirty, setConceptDirty] = useState(false);
  const [conceptSaving, setConceptSaving] = useState(false);
  const [conceptError, setConceptError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const activeSchemaIds = localConcept.schemaIds ?? concept?.schemaIds ?? [];
  const activeModeIds = localConcept.modeIds ?? concept?.modeIds ?? [];

  // Сброс при открытии другого клиента (вызывает openClient фасада)
  function resetConcept() {
    setConcept(null);
    setLocalConcept({});
    setConceptDirty(false);
    setConceptSaving(false);
    setConceptError('');
    setShowHistory(false);
  }

  function patchConcept(patch: Partial<ClientConceptualization>) {
    setLocalConcept((prev) => ({ ...prev, ...patch }));
    setConceptDirty(true);
  }

  function toggleSchemaId(id: string) {
    const current = localConcept.schemaIds ?? concept?.schemaIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    patchConcept({ schemaIds: next });
  }

  function toggleModeId(id: string) {
    const current = localConcept.modeIds ?? concept?.modeIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    patchConcept({ modeIds: next });
  }

  async function saveConcept() {
    if (!selectedClient || !conceptDirty) return;
    const clientId = selectedClient.telegramId;
    const isOpen = () => sameId(openClientIdRef.current, clientId);
    setConceptSaving(true);
    setConceptError('');
    try {
      const saved = await api.saveConceptualization(
        clientId,
        conceptSaveBody(localConcept),
      );
      if (!isOpen()) return;
      setConcept(saved);
      setLocalConcept(saved);
      setConceptDirty(false);
    } catch (e: unknown) {
      if (!isOpen()) return;
      const msg = e instanceof Error ? e.message : '';
      const over = conceptOverLimitField(localConcept);
      setConceptError(
        over
          ? conceptOverLimitText(over, tr)
          : msg.startsWith('API')
            ? tr(
                'Ошибка сервера. Попробуй позже.',
                'Ошибка сервера. Попробуйте позже.',
              )
            : msg || 'Ошибка сохранения',
      );
    } finally {
      if (isOpen()) setConceptSaving(false);
    }
  }

  return {
    concept,
    setConcept,
    localConcept,
    setLocalConcept,
    conceptDirty,
    setConceptDirty,
    conceptSaving,
    conceptError,
    showHistory,
    setShowHistory,
    activeSchemaIds,
    activeModeIds,
    resetConcept,
    patchConcept,
    toggleSchemaId,
    toggleModeId,
    saveConcept,
  };
}
