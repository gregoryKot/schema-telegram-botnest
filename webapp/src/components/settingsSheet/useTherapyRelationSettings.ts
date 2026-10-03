import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { TherapyRelationInfo } from '../../api';
import { useJoinTherapyErrorText } from '../../../../shared/src/therapy/useJoinTherapyErrorText';

// Логика разделов «Мой терапевт» (подключение по коду, отключение) и
// «Кабинет терапевта» (приглашение клиенту). Вынесено из SettingsSheet.tsx
// (правило №10). Сбои leaveTherapy/createTherapyInvite раньше глотались молча,
// а «Скопировано ✓» показывалось и при упавшем clipboard — теперь текст
// завязан на реальный inviteCopied. Отказ join: 409 already_connected — свой
// текст (код верный, мешает действующее подключение), иначе «Неверный код».
export function useTherapyRelationSettings(userRole: 'CLIENT' | 'THERAPIST' | undefined) {
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [therapyJoinCode, setTherapyJoinCode] = useState('');
  const [therapyJoinError, setTherapyJoinError] = useState('');
  const [leaveTherapyError, setLeaveTherapyError] = useState(false);
  const [therapyInviteUrl, setTherapyInviteUrl] = useState(''); const [inviteError, setInviteError] = useState(false);
  const joinErrorText = useJoinTherapyErrorText();
  const { copied: inviteCopied, copy: copyInvite } = useCopyToClipboard();

  useEffect(() => {
    api.getTherapyRelation().then(setTherapyRelation).catch(() => setTherapyRelation(null));
  }, [userRole]);

  function leaveTherapy() {
    setLeaveTherapyError(false);
    api.leaveTherapy().then(() => setTherapyRelation(null)).catch(() => setLeaveTherapyError(true));
  }

  async function joinTherapy() {
    if (!therapyJoinCode.trim()) return;
    setTherapyJoinError('');
    try {
      await api.joinTherapy(therapyJoinCode.trim());
      setTherapyRelation(await api.getTherapyRelation());
      setTherapyJoinCode('');
    } catch (e) { setTherapyJoinError(joinErrorText(e) ?? 'Неверный код'); }
  }

  async function createInvite() {
    setInviteError(false);
    try {
      const { url } = await api.createTherapyInvite();
      setTherapyInviteUrl(url);
      await copyInvite(url);
    } catch { setInviteError(true); }
  }

  return {
    therapyRelation, therapyJoinCode, setTherapyJoinCode, therapyJoinError,
    leaveTherapyError, therapyInviteUrl, inviteCopied, inviteError,
    leaveTherapy, joinTherapy, createInvite,
  };
}
