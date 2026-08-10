import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { TherapyRelationInfo } from '../../api';

// Логика разделов «Мой терапевт» (подключение по коду, отключение) и
// «Кабинет терапевта» (приглашение клиенту). Вынесено из SettingsSheet.tsx
// (правило №10). Раньше api.leaveTherapy() глотал сбой молча — «Отключиться
// от терапевта» не давало никакой обратной связи при отказе; а неудачное
// api.createTherapyInvite() тоже молчало, хотя кнопка выглядела нажатой.
// Отдельно: если приглашение создалось, но navigator.clipboard упал — раньше
// «Скопировано ✓» всё равно показывалось (успех подделывался), теперь текст
// завязан на реальный inviteCopied.
export function useTherapyRelationSettings(userRole: 'CLIENT' | 'THERAPIST' | undefined) {
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [therapyJoinCode, setTherapyJoinCode] = useState('');
  const [therapyJoinError, setTherapyJoinError] = useState('');
  const [leaveTherapyError, setLeaveTherapyError] = useState(false);
  const [therapyInviteUrl, setTherapyInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState(false);

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
    } catch { setTherapyJoinError('Неверный код'); }
  }

  async function createInvite() {
    setInviteError(false); setInviteCopied(false);
    try {
      const { url } = await api.createTherapyInvite();
      setTherapyInviteUrl(url);
      try { await navigator.clipboard.writeText(url); setInviteCopied(true); } catch { setInviteCopied(false); }
    } catch { setInviteError(true); }
  }

  return {
    therapyRelation, therapyJoinCode, setTherapyJoinCode, therapyJoinError,
    leaveTherapyError, therapyInviteUrl, inviteCopied, inviteError,
    leaveTherapy, joinTherapy, createInvite,
  };
}
