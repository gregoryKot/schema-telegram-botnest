import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type { TherapyClientSummary, ClientConceptualization } from '../../api';
import { conceptSaveBody } from '../../../../shared/src/therapy/conceptGraph/conceptSaveBody';
import { conceptSaveErrorText } from './conceptSaveError';

// Состояние и обработчики концептуализации клиента. Вынесено из
// useClientDetail.ts (правило №10); публичная форма возврата хука-фасада
// не изменилась.
export function useConceptEditing(selectedClient: TherapyClientSummary | null) {
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
    setConceptSaving(true);
    setConceptError('');
    try {
      const saved = await api.saveConceptualization(
        selectedClient.telegramId,
        conceptSaveBody(localConcept),
      );
      setConcept(saved);
      setLocalConcept(saved);
      setConceptDirty(false);
    } catch (e: unknown) {
      // Причина уходит в строку статуса (ConceptSaveBar → SaveStatusLine.errorText).
      setConceptError(conceptSaveErrorText(e, tr));
    } finally {
      setConceptSaving(false);
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
