import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import {
  ACCOUNT_LINK_CONFIRMED_EVENT,
  type AccountLinkHost,
} from '../../../../shared/src/share/analytics';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export interface LinkPreview {
  provider: string;
  displayName: string | null;
  sameAccount: boolean;
  summary: Record<string, number>;
  twoFactorLost: boolean;
}

export type LinkPhase = 'ask' | 'done' | 'denied';

// Билет привязки мессенджера (`intent: 'link'`) со стороны браузера: сводка,
// подтверждение, отказ. Вынесено из LinkDevicePage (правило №10: страница в
// бейслайне размера и может только худеть).
export function useLinkTicket(code: string) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'approve' | 'deny'>(null);
  const [phase, setPhase] = useState<LinkPhase>('ask');

  const call = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api/auth/ticket/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error((await readHumanError(res, 'Не получилось')).message);
    return res.json().catch(() => ({})) as Promise<unknown>;
  }, [code]);

  useEffect(() => {
    let alive = true;
    call('preview')
      .then((p) => { if (alive) setPreview(p as LinkPreview); })
      .catch((e: unknown) => { if (alive) setError(humanizeThrown(e, 'Не получилось')); });
    return () => { alive = false; };
  }, [call]);

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      const res = (await call('approve')) as { merged?: boolean; repeat?: boolean };
      // Успех считает именно этот экран (мини-апп ещё ждёт и не знает) —
      // ровно один раз: повтор из второй вкладки уже посчитан первым.
      if (!res.repeat) api.trackEvent(ACCOUNT_LINK_CONFIRMED_EVENT, {
        host: (preview?.provider ?? 'max') as AccountLinkHost,
        merged: res.merged === true,
      });
      setPhase('done');
    } catch (e) {
      setError(humanizeThrown(e, 'Не получилось'));
    } finally {
      setBusy(null);
    }
  };

  // «Это не я». Ручка общая с входом (`deny-login` гасит живой билет любого
  // intent — LoginTicketService.deny): ждущий мини-апп получает `denied`, а не
  // висит до истечения. Событие не шлём: отказ — сработавшая защита, а не
  // провал переноса (LinkAccountSection намеренно не считает 'denied').
  const deny = async () => {
    setBusy('deny');
    setError(null);
    try {
      await call('deny-login');
      setPhase('denied');
    } catch {
      // Не долетело — код всё равно никто не подтвердил, билет истечёт сам.
      setPhase('denied');
    } finally {
      setBusy(null);
    }
  };

  return { preview, error, busy, phase, approve, deny };
}

/** Текст галочки — по реальному эффекту approve (TicketLinkService.approve). */
export function linkAckText(messenger: string, sameAccount: boolean): string {
  const access = `Я понимаю, что приложение в ${messenger} получит полный доступ к этому аккаунту`;
  return sameAccount
    ? `${access}.`
    : `${access}, его данные необратимо переедут сюда, а прежний аккаунт приложения будет удалён.`;
}
