import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { TherapyRelationInfo } from '../../api';
import { useTherapyCodeJoin } from '../../../../shared/src/therapy/useTherapyCodeJoin';
import { loadFreshTherapyRelation } from '../../../../shared/src/therapy/freshRelation';
import { useConfirmedAction } from '../../../../shared/src/hooks/useConfirmedAction';
import { inviteCreateErrorText } from '../../../../shared/src/therapy/therapyInvites';
import { cacheClientRelation } from '../../../../shared/src/utils/therapistContact';
import { notifyTasksChanged } from '../../../../shared/src/tasks/tasksChanged';

// Логика разделов «Мой терапевт» (подключение по коду, отключение) и
// «Кабинет терапевта» (приглашение клиенту). Вынесено из SettingsSheet.tsx
// (правило №10). Сбои leaveTherapy/createTherapyInvite раньше глотались молча,
// а «Скопировано ✓» показывалось и при упавшем clipboard — теперь текст
// завязан на реальный inviteCopied. Подключение по коду — общий хук (ввод
// чистится, 409 — свой текст); отключение — только после подтверждения
// (инцидент 2026-10-26: связь удалялась одним тапом). Кэш «Написать терапевту»
// обновляется здесь же: до 2026-11-05 после отключения мост в «Ещё» вёл к
// бывшему терапевту до перезагрузки, а после подключения кодом не появлялся.
// Отключение делает открытые задания терапевта личными целями — экраны со
// списком заданий под листом перечитывают его (метка «От терапевта» уходит).
export function useTherapyRelationSettings(userRole: 'CLIENT' | 'THERAPIST' | undefined) {
  const tr = useTr();
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [invite, setInvite] = useState<{ url: string; code: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const { copied: inviteCopied, copy: copyInvite } = useCopyToClipboard();
  const applyRelation = (rel: TherapyRelationInfo | null) => { setTherapyRelation(rel); cacheClientRelation(rel); };
  const join = useTherapyCodeJoin(api, applyRelation);
  const leave = useConfirmedAction(() => api.leaveTherapy(), () => { applyRelation(null); notifyTasksChanged(); });

  // При открытии — с сервера: связь могла появиться на другом устройстве (М4).
  useEffect(() => {
    loadFreshTherapyRelation(api.getTherapyRelation).then(setTherapyRelation).catch(() => setTherapyRelation(null));
  }, [userRole]);

  // Каждый тап — новое приглашение со своим кодом (раньше — тот же код
  // повторно, и второй клиент получал ссылку первого).
  async function createInvite() {
    setInviteError('');
    try {
      const created = await api.createTherapyInvite();
      setInvite(created);
      await copyInvite(created.url);
    } catch (e) { setInviteError(inviteCreateErrorText(e, tr)); }
  }

  return {
    therapyRelation, join, leave,
    invite, inviteCopied, inviteError, createInvite,
  };
}
