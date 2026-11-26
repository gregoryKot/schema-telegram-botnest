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
import { useSectionLoadFailure } from './useSectionLoadFailure';

// Логика разделов «Мой терапевт» (подключение по коду, отключение) и «Кабинет терапевта»
// (приглашение клиенту). «Скопировано ✓» завязано на реальный inviteCopied. Подключение по коду —
// общий хук (ввод чистится, 409 — свой текст); отключение — только после подтверждения. Кэш
// «Написать терапевту» обновляется здесь же, иначе мост в «Ещё» вёл бы к бывшему терапевту.
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

  const load = useSectionLoadFailure('therapy relation');

  // При открытии — с сервера: связь могла появиться на другом устройстве (М4). Сбой ≠ «терапевта нет».
  useEffect(() => {
    loadFreshTherapyRelation(api.getTherapyRelation).then(setTherapyRelation).catch(load.fail);
  }, [userRole, load.fail, load.attempt]);

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
    therapyRelation, load, join, leave,
    invite, inviteCopied, inviteError, createInvite,
  };
}
