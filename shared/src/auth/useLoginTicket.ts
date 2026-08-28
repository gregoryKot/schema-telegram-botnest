// Механика входа по билету — одна реализация на оба фронтенда (правило №3 и
// «одна механика — один компонент»). Копия этого цикла в двух api.ts означала
// бы, что правку внесут в одну, а вторая тихо останется старой.
//
// Суть: приложение НЕ уходит подтверждать вход само. Оно открывает подтверждение
// СНАРУЖИ (ссылка в бота или страница провайдера в браузере) и остаётся жить,
// опрашивая сервер. Поэтому сессия и возвращается в тот контейнер, где вход
// начался, — установленное приложение не видит куку внешнего браузера, и до
// билета вход оттуда был невозможен в принципе (разбор 2026-08-28).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoginProvider, LoginTicketApi } from './loginTicketApi';

export interface LoginTicketDeps {
  api: LoginTicketApi;
  /** Где открыт контейнер — уезжает на сервер для подписи устройства и метрик. */
  hostId: string;
  /** Имя бота для ссылки `t.me/<bot>?start=login_<КОД>`. */
  botUsername: string;
  /** Куда бить за OAuth: обычно '' (тот же origin) или VITE_API_URL. */
  apiBase: string;
  /** Сессия получена — фронт кладёт её к себе (setAccessToken / adoptSession). */
  onSession: (accessToken: string, expiresIn: number) => void;
}

export type LoginTicketState =
  | { kind: 'idle' }
  | { kind: 'starting'; provider: LoginProvider }
  /** Ссылка открыта, ждём подтверждения. `url` показывается кнопкой-ссылкой. */
  | { kind: 'waiting'; provider: LoginProvider; code: string; url: string }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'failed' };

/** Минимальная пауза опроса: сервер называет свою, но нулю верить нельзя. */
const MIN_INTERVAL_S = 1;

export function loginUrl(
  provider: LoginProvider,
  code: string,
  deps: { botUsername: string; apiBase: string },
): string {
  if (provider === 'telegram') {
    return `https://t.me/${deps.botUsername}?start=login_${code}`;
  }
  // Код едет параметром, а сервер прячет его внутрь подписанного `state` —
  // подменяемый код позволил бы направить чужую свежую сессию в свой билет.
  return `${deps.apiBase}/api/auth/${provider}?ticket=${encodeURIComponent(code)}`;
}

export function useLoginTicket(deps: LoginTicketDeps) {
  const [state, setState] = useState<LoginTicketState>({ kind: 'idle' });
  // Зависимости держим в ref: вызывающие собирают объект `deps` прямо в
  // рендере, и без этого `begin` менялся бы каждый рендер — эффект «начать
  // вход при открытии экрана» перезапускался бы и плодил билеты.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // Опрос живёт вне рендера: перерисовка экрана не должна ни удваивать его,
  // ни обрывать.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const begin = useCallback(
    async (provider: LoginProvider) => {
      stop();
      setState({ kind: 'starting', provider });
      let ticket;
      const d = depsRef.current;
      try {
        ticket = await d.api.start({
          intent: 'login',
          provider,
          hostId: d.hostId,
        });
      } catch {
        if (alive.current) setState({ kind: 'failed' });
        return null;
      }
      if (!alive.current) return null;

      const url = loginUrl(provider, ticket.userCode, d);
      setState({ kind: 'waiting', provider, code: ticket.userCode, url });

      const intervalMs = Math.max(ticket.interval || 0, MIN_INTERVAL_S) * 1000;
      const deadline = Date.now() + ticket.expiresIn * 1000;

      const tick = async () => {
        if (!alive.current) return;
        if (Date.now() > deadline) {
          setState({ kind: 'expired' });
          return;
        }
        let res;
        try {
          res = await depsRef.current.api.poll(ticket.deviceCode);
        } catch {
          // Сеть моргнула — это не отказ во входе. Ждём следующего круга:
          // человек в этот момент подтверждает вход в другом приложении.
          timer.current = setTimeout(() => void tick(), intervalMs);
          return;
        }
        if (!alive.current) return;
        if (res.status === 'linked' && res.accessToken) {
          depsRef.current.onSession(res.accessToken, res.expiresIn ?? 900);
          return;
        }
        if (res.status === 'denied') {
          setState({ kind: 'denied' });
          return;
        }
        if (res.status === 'expired') {
          setState({ kind: 'expired' });
          return;
        }
        timer.current = setTimeout(() => void tick(), intervalMs);
      };

      timer.current = setTimeout(() => void tick(), intervalMs);
      return url;
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setState({ kind: 'idle' });
  }, [stop]);

  return { state, begin, reset };
}
