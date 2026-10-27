import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { TherapyRelationInfo } from '../../api';
import { useTherapyCodeJoin } from '../../../../shared/src/therapy/useTherapyCodeJoin';
import { useConfirmedAction } from '../../../../shared/src/hooks/useConfirmedAction';
import { inviteCreateErrorText } from '../../../../shared/src/therapy/therapyInvites';

// Логика разделов «Мой терапевт» (подключение по коду, отключение) и
// «Кабинет терапевта» (приглашение клиенту). Вынесено из SettingsSheet.tsx
// (правило №10). Сбои leaveTherapy/createTherapyInvite раньше глотались молча,
// а «Скопировано ✓» показывалось и при упавшем clipboard — теперь текст
// завязан на реальный inviteCopied. Подключение по коду — общий с мини-аппом
// хук (ввод чистится, 409 — свой текст); отключение — только после
// подтверждения (инцидент 2026-10-26: связь удалялась одним тапом).
export function useTherapyRelationSettings(userRole: 'CLIENT' | 'THERAPIST' | undefined) {
  const tr = useTr();
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [invite, setInvite] = useState<{ url: string; code: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const { copied: inviteCopied, copy: copyInvite } = useCopyToClipboard();
  const join = useTherapyCodeJoin(api, setTherapyRelation);
  const leave = useConfirmedAction(() => api.leaveTherapy(), () => setTherapyRelation(null));

  useEffect(() => {
    api.getTherapyRelation().then(setTherapyRelation).catch(() => setTherapyRelation(null));
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
