import { useState, useEffect } from 'react';
import { api, PairsData } from '../../api';

// Единственная реализация логики механики «пара с другом» (правило №11
// CLAUDE.md, «одна механика — один компонент»): раньше загрузка/создание
// приглашения/вступление по коду/отвязка были написаны дважды — независимо
// в PairSheet.tsx и в SettingsSheet.tsx/PartnerSection.tsx, — и один и тот же
// баг (захардкоженное «ты») жил в обеих копиях. Разметка — в PairPanel.tsx,
// сюда — только запросы и состояние.
//
// onInviteCreated — единственная точка, где поведение двух поверхностей
// осознанно расходится: PairSheet показывает карточку-приглашение
// (ShareCardSheet), PartnerSection в настройках — best-effort
// navigator.share(). Само создание/сохранение кода — общее.
export function usePairMechanics(
  onInviteCreated?: (code: string, url: string) => void,
) {
  const [data, setData] = useState<PairsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createError, setCreateError] = useState(false);
  const [joinView, setJoinView] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState(false);
  const [confirmLeaveCode, setConfirmLeaveCode] = useState<string | null>(
    null,
  );

  useEffect(() => {
    api
      .getPair()
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  async function handleCreateInvite() {
    setLoading(true);
    setCreateError(false);
    try {
      const { code, url } = await api.createPairInvite();
      setInviteUrl(url);
      setInviteCode(code);
      api
        .getPair()
        .then(setData)
        .catch((e) => console.error('getPair failed', e));
      onInviteCreated?.(code, url);
    } catch (e) {
      // Провал самого действия, а не best-effort мелочи — кнопка обязана
      // сообщить, не промолчать (regression: check-silent-catch).
      console.error('createPairInvite failed', e);
      setCreateError(true);
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setJoinError(false);
    try {
      await api.joinPair(joinCode.trim().toUpperCase());
      setData(await api.getPair());
      setJoinView('main');
      setJoinCode('');
    } catch {
      setJoinError(true);
    }
    setLoading(false);
  }

  async function handleLeave(code: string) {
    try {
      await api.leavePair(code);
      setData(await api.getPair());
    } catch (e) {
      console.error('leavePair failed', e);
    }
    setConfirmLeaveCode(null);
  }

  return {
    data,
    loadError,
    loading,
    inviteUrl,
    inviteCode,
    createError,
    joinView,
    setJoinView,
    joinCode,
    setJoinCode,
    joinError,
    confirmLeaveCode,
    setConfirmLeaveCode,
    handleCreateInvite,
    handleJoin,
    handleLeave,
  };
}

export type PairMechanics = ReturnType<typeof usePairMechanics>;
