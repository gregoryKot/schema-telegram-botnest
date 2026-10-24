import { useCallback, useEffect, useRef, useState } from 'react';
import type { PairsData } from '../apiTypes';

// Единственная реализация логики механики «пара с другом» для обоих
// фронтендов (правила №3 и №11 CLAUDE.md). Раньше она была написана дважды:
// usePairMechanics в мини-аппе и usePairSettings на сайте — и копии разошлись
// поведением (на сайте выход из пары шёл без подтверждения, в мини-аппе
// сбой выхода глотался в console.error). Здесь взято лучшее из обеих:
// видимые ошибки загрузки/создания/выхода, подтверждение выхода, повтор
// загрузки. API приходит параметром — хук не знает, чей он фронтенд.
//
// onInviteCreated — точка, где поверхности расходятся осознанно: лист «Вместе»
// показывает карточку-приглашение, настройки шарят нативно или тоже карточкой.
// reportError — отчёт наверх (reportClientError фронтенда): сбой не должен
// жить только в консоли (check-silent-catch).
// reloadKey — смена значения (роль пользователя) перезагружает пару.

export interface PairApi {
  getPair: () => Promise<PairsData>;
  createPairInvite: () => Promise<{ code: string; url: string }>;
  joinPair: (code: string) => Promise<unknown>;
  leavePair: (code: string) => Promise<unknown>;
}

export interface PairOptions {
  onInviteCreated?: (code: string, url: string) => void;
  reportError?: (message: string) => void;
  reloadKey?: unknown;
}

export function usePairMechanics(api: PairApi, options: PairOptions = {}) {
  const [data, setData] = useState<PairsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createError, setCreateError] = useState(false);
  const [joinView, setJoinView] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const [confirmLeaveCode, setConfirmLeaveCode] = useState<string | null>(null);

  // Свежие колбэки без перезапуска эффекта загрузки.
  const opts = useRef(options);
  opts.current = options;
  const apiRef = useRef(api);
  apiRef.current = api;

  const load = useCallback(async () => {
    try {
      setData(await apiRef.current.getPair());
      setLoadError(false);
    } catch {
      opts.current.reportError?.('pair load failed');
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, options.reloadKey]);

  function retryLoad() {
    setLoadError(false);
    void load();
  }

  async function handleCreateInvite() {
    setLoading(true);
    setCreateError(false);
    try {
      const { code, url } = await apiRef.current.createPairInvite();
      setInviteUrl(url);
      setInviteCode(code);
      opts.current.onInviteCreated?.(code, url);
      await load();
    } catch {
      opts.current.reportError?.('pair create invite failed');
      setCreateError(true);
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setJoinError(false);
    try {
      await apiRef.current.joinPair(joinCode.trim().toUpperCase());
      setJoinView('main');
      setJoinCode('');
      await load();
    } catch {
      // Код не найден или занят — ожидаемый исход, не авария: без отчёта.
      setJoinError(true);
    }
    setLoading(false);
  }

  async function handleLeave(code: string) {
    setLeaveError(false);
    try {
      await apiRef.current.leavePair(code);
      await load();
    } catch {
      opts.current.reportError?.('pair leave failed');
      setLeaveError(true);
    }
    setConfirmLeaveCode(null);
  }

  return {
    data,
    loadError,
    retryLoad,
    loading,
    inviteUrl,
    inviteCode,
    createError,
    joinView,
    setJoinView,
    joinCode,
    setJoinCode,
    joinError,
    leaveError,
    confirmLeaveCode,
    setConfirmLeaveCode,
    handleCreateInvite,
    handleJoin,
    handleLeave,
  };
}

export type PairMechanics = ReturnType<typeof usePairMechanics>;
