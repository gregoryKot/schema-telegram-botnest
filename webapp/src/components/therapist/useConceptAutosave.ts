import { useRef, useState } from 'react';
import { api, reportClientError, type ClientConceptualization, type UserId } from '../../api';
import { conceptSaveBody, type ConceptSaveBody } from '../../../../shared/src/therapy/conceptGraph/conceptSaveBody';
import { conceptOverLimitField, conceptOverLimitText } from '../../../../shared/src/therapy/conceptOverLimit';
import { usePendingSave } from '../../../../shared/src/utils/usePendingSave';
import { sameId } from '../../../../shared/src/utils/sameId';
import { useTr } from '../../utils/addressForm';

type LocalConcept = Partial<ClientConceptualization>;
const SECTION = 'therapist.clientDetail';

// Концептуализация открытого клиента: локальные правки и автосохранение
// через 700 мс. Вынесено из useClientDetail.ts (правило №10) вместе с
// починкой инцидента 2026-10-26 (docs/INCIDENTS.md): таймер брал id клиента
// из замыкания, а тело — из рефа, который к срабатыванию уже заполнил
// следующий клиент. Теперь id и тело запоминаются вместе в момент правки
// (shared usePendingSave): при смене клиента правка уходит прежнему с ЕГО
// данными, при уходе со страницы — keepalive-досылкой. Ответ, пришедший
// после смены клиента, state карточки не трогает — она уже чужая.
export function useConceptAutosave(openClientIdRef: { readonly current: UserId | null }) {
  const tr = useTr();
  const [concept, setConcept] = useState<ClientConceptualization | null>(null);
  const [localConcept, setLocalConcept] = useState<LocalConcept>({});
  // Зеркало localConcept, обновляемое синхронно: правка за правкой до
  // рендера собирает тело из последней версии, а не из state рендера.
  const localRef = useRef<LocalConcept>({});
  const [conceptError, setConceptError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');
  const isOpen = (id: UserId) => sameId(openClientIdRef.current, id);

  function setLocal(next: LocalConcept) {
    localRef.current = next;
    setLocalConcept(next);
  }

  // Досылка при уходе (`leaving`) — тот же путь, только keepalive: вкладка,
  // скрытая и открытая снова, видит «✓ сохранено» или ошибку, а не вечное
  // «автосохранение»; после размонтирования setState — no-op.
  async function send(clientId: UserId, body: ConceptSaveBody, { leaving }: { leaving: boolean }) {
    if (isOpen(clientId)) setSaveStatus('saving');
    try {
      const saved = await (leaving ? api.saveConceptualization(clientId, body, { keepalive: true }) : api.saveConceptualization(clientId, body));
      if (!isOpen(clientId)) return;
      setConcept(saved);
      setConceptError('');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      // Карточка уже другого клиента или закрыта — показать отказ негде, но молчать нельзя.
      if (leaving || !isOpen(clientId)) reportClientError({ message: 'concept save failed after leaving the client', section: SECTION });
      if (!isOpen(clientId)) return;
      setSaveStatus('idle');
      const over = conceptOverLimitField(body);
      setConceptError(over ? conceptOverLimitText(over, tr) : tr('Не удалось сохранить изменения. Попробуй ещё раз.', 'Не удалось сохранить изменения. Попробуйте ещё раз.'));
    }
  }

  const saver = usePendingSave<UserId, ConceptSaveBody>({
    delayMs: 700,
    send,
    isSameKey: sameId,
    onLeaveError: () => reportClientError({ message: 'concept leave save failed', section: SECTION }),
  });

  function patchConcept(patch: LocalConcept) {
    const clientId = openClientIdRef.current;
    if (clientId == null) return;
    const next = { ...localRef.current, ...patch };
    setLocal(next);
    setSaveStatus('pending');
    saver.schedule(clientId, conceptSaveBody(next));
  }

  function toggleId(field: 'schemaIds' | 'modeIds', id: string) {
    const current = (localRef.current[field] ?? concept?.[field] ?? []) as string[];
    patchConcept({ [field]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  }

  /** Смена клиента: ожидающая правка сразу уходит прежнему клиенту, карточка обнуляется. */
  function resetForClient() {
    saver.flush();
    setConcept(null);
    setLocal({});
    setConceptError('');
    setSaveStatus('idle');
  }

  function loadConcept(fetched: ClientConceptualization | null) {
    setConcept(fetched);
    if (fetched) setLocal(fetched);
  }

  return {
    concept, localConcept, conceptError, saveStatus,
    activeSchemaIds: (localConcept.schemaIds ?? concept?.schemaIds ?? []) as string[],
    activeModeIds: (localConcept.modeIds ?? concept?.modeIds ?? []) as string[],
    patchConcept,
    toggleSchemaId: (id: string) => toggleId('schemaIds', id),
    toggleModeId: (id: string) => toggleId('modeIds', id),
    resetForClient, loadConcept,
  };
}
