import { useState, type Dispatch, type SetStateAction } from 'react';
import type { TherapyClientSummary } from '../types';
import type { UserId } from '../userId';
import { sameId } from '../utils/sameId';

// Редактирование данных сессий (дата старта, следующая встреча, дни недели)
// и имени-алиаса клиента в карточке у терапевта — одна механика на оба фронта
// (правило №3). До инцидента 2026-10-26 (docs/INCIDENTS.md, класс 18) жила
// копией в useClientDetail сайта и файлом мини-аппа, и обе копии после ответа
// сервера возвращали в карточку прежнего клиента (`setSelectedClient(updated)`),
// если терапевт уже перешёл к другому, — следующая правка ушла бы прежнему.
// Теперь карточка меняется, только если открыт тот же клиент; флаги и ошибки
// прежнего в чужую карточку не попадают; `resetSessionAlias` (из openClient)
// сбрасывает и черновики, и флаги.

export interface SessionInfoPatch {
  therapyStartDate?: string | null;
  nextSession?: string | null;
  meetingDays?: number[];
}

interface Params {
  selectedClient: TherapyClientSummary | null;
  setSelectedClient: Dispatch<SetStateAction<TherapyClientSummary | null>>;
  setClients: Dispatch<SetStateAction<TherapyClientSummary[]>>;
  openClientIdRef: { readonly current: UserId | null };
  send: {
    renameClient: (clientId: UserId, alias: string) => Promise<unknown>;
    updateSessionInfo: (
      clientId: UserId,
      patch: SessionInfoPatch,
    ) => Promise<unknown>;
  };
  /** Текст ошибки дат; `clearAfterMs` — снять его сам (мини-апп), иначе висит до следующей попытки. */
  sessionError: { text: string; clearAfterMs?: number };
}

export function useSessionAliasEditing({
  selectedClient,
  setSelectedClient,
  setClients,
  openClientIdRef,
  send,
  sessionError,
}: Params) {
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
  const isOpen = (id: UserId) => sameId(openClientIdRef.current, id);

  function applyClientUpdate(updated: TherapyClientSummary) {
    setSelectedClient((cur) =>
      cur && sameId(cur.telegramId, updated.telegramId) ? updated : cur,
    );
    setClients((prev) =>
      prev.map((c) => (sameId(c.telegramId, updated.telegramId) ? updated : c)),
    );
  }

  // Сброс при открытии другого клиента (вызывает openClient фасада)
  function resetSessionAlias(client: TherapyClientSummary) {
    setRenamingAlias(false);
    setAliasInput('');
    setAliasSaving(false);
    setAliasError('');
    setSessionInfoSaving(false);
    setSessionInfoError('');
    setEditingStartDate(false);
    setEditingNextSession(false);
    setEditingDays(false);
    setLocalMeetingDays(client.meetingDays ?? []);
    setLocalNextSession(client.nextSession ?? '');
    setLocalStartDate(client.therapyStartDate ?? '');
  }

  async function saveAlias() {
    if (!selectedClient) return;
    const clientId = selectedClient.telegramId;
    setAliasSaving(true);
    setAliasError('');
    try {
      await send.renameClient(clientId, aliasInput);
      applyClientUpdate({
        ...selectedClient,
        clientAlias: aliasInput.trim() || null,
      });
      if (isOpen(clientId)) setRenamingAlias(false);
    } catch {
      if (isOpen(clientId)) setAliasError('Не удалось сохранить имя');
    } finally {
      if (isOpen(clientId)) setAliasSaving(false);
    }
  }

  // Исход возвращается явно: раньше catch глушил ошибку, и кнопка закрывала
  // поле, как будто сохранилось.
  async function saveSessionInfo(patch: SessionInfoPatch): Promise<boolean> {
    if (!selectedClient) return false;
    const clientId = selectedClient.telegramId;
    setSessionInfoSaving(true);
    setSessionInfoError('');
    try {
      await send.updateSessionInfo(clientId, patch);
      const updated = { ...selectedClient, ...patch };
      if (patch.meetingDays !== undefined)
        updated.meetingDays = patch.meetingDays;
      applyClientUpdate(updated);
      return true;
    } catch {
      if (!isOpen(clientId)) return false;
      setSessionInfoError(sessionError.text);
      if (sessionError.clearAfterMs)
        setTimeout(() => setSessionInfoError(''), sessionError.clearAfterMs);
      return false;
    } finally {
      if (isOpen(clientId)) setSessionInfoSaving(false);
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
