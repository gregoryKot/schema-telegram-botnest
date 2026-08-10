import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { PairsData } from '../../api';

// Логика раздела «Партнёр» — вынесена из SettingsSheet.tsx (правило №10,
// файл-должник, пофайловый храповик размера). Раньше getPair()/leavePair()
// глотали сбой сети молча (`.catch(() => {})`): пользователь с реально
// подключённым партнёром на сетевом сбое видел экран «пригласить друга»,
// будто связь пропала, а «Выйти из пары» не давало вообще никакой обратной
// связи при отказе. Теперь оба исхода видны через pairLoadError/leaveError.
export function usePairSettings(userRole: 'CLIENT' | 'THERAPIST' | undefined) {
  const [pairData, setPairData] = useState<PairsData | null>(null);
  const [pairLoading, setPairLoading] = useState(true);
  const [pairLoadError, setPairLoadError] = useState(false);
  const [pairInviteUrl, setPairInviteUrl] = useState('');
  const [pairInviteCopied, setPairInviteCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinView, setJoinView] = useState<'main' | 'join'>('main');
  const [joinError, setJoinError] = useState(false);
  const [leaveError, setLeaveError] = useState(false);

  // Re-show loading when the role context changes (same trick as SettingsSheet).
  const [seenRole, setSeenRole] = useState(userRole);
  if (userRole !== seenRole) { setSeenRole(userRole); setPairLoading(true); }

  function loadPair() {
    return api.getPair()
      .then(d => { setPairData(d); setPairLoadError(false); })
      .catch(() => setPairLoadError(true));
  }

  useEffect(() => { loadPair().finally(() => setPairLoading(false)); }, [userRole]);

  async function handleCreateInvite() {
    setPairLoading(true);
    try {
      const { code, url } = await api.createPairInvite();
      await loadPair();
      setPairInviteUrl(url);
      return { code, url };
    } finally { setPairLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setPairLoading(true); setJoinError(false);
    try {
      await api.joinPair(joinCode.trim().toUpperCase());
      await loadPair();
      setJoinView('main');
    } catch { setJoinError(true); } finally { setPairLoading(false); }
  }

  function leavePair(code: string) {
    setLeaveError(false);
    api.leavePair(code).then(loadPair).catch(() => setLeaveError(true));
  }

  function retryLoad() {
    setPairLoading(true);
    loadPair().finally(() => setPairLoading(false));
  }

  return {
    pairData, pairLoading, pairLoadError,
    pairInviteUrl, pairInviteCopied, setPairInviteCopied,
    joinCode, setJoinCode, joinView, setJoinView, joinError,
    leaveError, handleCreateInvite, handleJoin, leavePair, retryLoad,
  };
}
