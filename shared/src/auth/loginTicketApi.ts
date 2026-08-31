// Сетевая половина билета входа — одна копия на оба фронтенда (правило №3).
//
// Без авторизации: билет затем и нужен, что у контейнера сессии ещё нет.
// Доказательством служит длинный секрет, который никогда не покидает этот
// контейнер (RFC 8628), поэтому `credentials: 'include'` тут обязателен —
// именно СЮДА сервер положит refresh-куку, когда вход подтвердят.
export type LoginProvider = 'telegram' | 'google' | 'vk' | 'email';

export interface StartedTicket {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
}

export interface PolledTicket {
  status: 'pending' | 'linked' | 'denied' | 'expired';
  accessToken?: string;
  expiresIn?: number;
}

export interface LoginTicketApi {
  start(input: {
    intent: 'login' | 'link';
    provider: LoginProvider;
    hostId: string;
  }): Promise<StartedTicket>;
  poll(deviceCode: string): Promise<PolledTicket>;
}

/**
 * `authedFetch` нужен только привязке (`intent: 'link'`): к ЧЕМУ привязывать —
 * знает сессия, и сервер такой запрос без неё отбивает. Вход остаётся
 * анонимным, поэтому параметр необязательный, а второй сетевой модуль рядом
 * заводить незачем (правило «одна механика — один компонент»).
 */
export function createLoginTicketApi(
  base: string,
  authedFetch?: (path: string, init: RequestInit) => Promise<Response>,
): LoginTicketApi {
  const headers = {
    'Content-Type': 'application/json',
    // CSRF-заголовок, как у остальных запросов обоих фронтендов.
    'x-requested-with': 'ticket',
  };
  const call = async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    start: async (input) => {
      if (!authedFetch) {
        return call<StartedTicket>('/api/auth/ticket/start', input);
      }
      const res = await authedFetch('/api/auth/ticket/start', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as StartedTicket;
    },
    // Опрос идёт БЕЗ авторизации намеренно: к моменту подтверждения аккаунт
    // источника уже слит с целевым, и его токен ничего не доказывает.
    // Доказательством служит сам длинный код (RFC 8628).
    poll: (deviceCode) =>
      call<PolledTicket>('/api/auth/ticket/poll', { deviceCode }),
  };
}
