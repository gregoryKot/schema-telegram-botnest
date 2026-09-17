import { useState } from 'react';
import { api } from '../../api';
import type { TherapyClientSummary } from '../../api';

// Редактирование данных сессий (дата старта, следующая встреча, дни недели)
// и имени-алиаса клиента. Вынесено из useClientDetail.ts (правило №10);
// публичная форма возврата хука-фасада не изменилась.
export function useSessionAliasEditing({
  selectedClient,
  setSelectedClient,
  setClients,
}: {
  selectedClient: TherapyClientSummary | null;
  setSelectedClient: React.Dispatch<
    React.SetStateAction<TherapyClientSummary | null>
  >;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}) {
  // Session info editing
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [localStartDate, setLocalStartDate] = useState('');
  const [editingNextSession, setEditingNextSession] = useState(false);
  const [localNextSession, setLocalNextSession] = useState('');
  const [editingDays, setEditingDays] = useState(false);
  const [localMeetingDays, setLocalMeetingDays] = useState<number[]>([]);
  const [sessionInfoSaving, setSessionInfoSaving] = useState(false);
  const [sessionInfoError, setSessionInfoError] = useState('');

  // Alias editing
  const [renamingAlias, setRenamingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState('');

  // Сброс при открытии другого клиента (вызывает openClient фасада)
  function resetSessionAlias(client: TherapyClientSummary) {
    setRenamingAlias(false);
    setAliasError('');
    setEditingStartDate(false);
    setEditingNextSession(false);
    setEditingDays(false);
    setLocalMeetingDays(client.meetingDays ?? []);
    setLocalNextSession(client.nextSession ?? '');
    setLocalStartDate(client.therapyStartDate ?? '');
  }

  async function saveAlias() {
    if (!selectedClient) return;
    setAliasSaving(true);
    setAliasError('');
    try {
      await api.renameClient(selectedClient.telegramId, aliasInput);
      const updated = {
        ...selectedClient,
        clientAlias: aliasInput.trim() || null,
      };
      setSelectedClient(updated);
      setClients((prev) =>
        prev.map((c) =>
          c.telegramId === selectedClient.telegramId ? updated : c,
        ),
      );
      setRenamingAlias(false);
    } catch {
      setAliasError('Не удалось сохранить имя');
    } finally {
      setAliasSaving(false);
    }
  }

  async function saveSessionInfo(patch: {
    therapyStartDate?: string | null;
    nextSession?: string | null;
    meetingDays?: number[];
  }) {
    if (!selectedClient) return;
    setSessionInfoSaving(true);
    setSessionInfoError('');
    try {
      await api.updateSessionInfo(selectedClient.telegramId, patch);
      const updated = { ...selectedClient, ...patch };
      if (patch.meetingDays !== undefined)
        updated.meetingDays = patch.meetingDays;
      setSelectedClient(updated);
      setClients((prev) =>
        prev.map((c) =>
          c.telegramId === selectedClient.telegramId ? updated : c,
        ),
      );
    } catch {
      setSessionInfoError('Не удалось сохранить');
      setTimeout(() => setSessionInfoError(''), 3000);
    } finally {
      setSessionInfoSaving(false);
    }
  }

  return {
    editingStartDate,
    setEditingStartDate,
    localStartDate,
    setLocalStartDate,
    editingNextSession,
    setEditingNextSession,
    localNextSession,
    setLocalNextSession,
    editingDays,
    setEditingDays,
    localMeetingDays,
    setLocalMeetingDays,
    sessionInfoSaving,
    sessionInfoError,
    renamingAlias,
    setRenamingAlias,
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasError,
    setAliasError,
    resetSessionAlias,
    saveAlias,
    saveSessionInfo,
  };
}
