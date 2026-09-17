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
  /**
   * 'login' (по умолчанию) — впустить в пустой контейнер. 'link' — объединить
   * с уже существующим аккаунтом: механика та же (выписали код, подтвердили
   * снаружи, забрали сессию опросом), меняются намерение и адрес ссылки.
   */
  intent?: 'login' | 'link';
  /** Чем открывать подтверждение. По умолчанию — ссылка входа. */
  urlFor?: (
    provider: LoginProvider,
    code: string,
    deps: { botUsername: string; apiBase: string },
  ) => string;
  /** Куда уводит контейнер, у которого обычных ссылок нет (мини-апп). */
  openExternally?: (url: string) => void;
  /**
   * Сообщить наверх, что билет не удалось даже выписать. Единственное, чего
   * сервер про вход не знает: запрос мог не дойти вовсе — сеть, прокси,
   * закрытая вкладка. Экран при этом не крашится, он аккуратно показывает
   * «не получилось», и без отчёта такая авария невидима (правило №14:
   * обработанная авария невидимее необработанной).
   */
  reportError?: (payload: { message: string; section: string }) => void;
}

/**
 * Секция отчёта о поломке. Своя, а не общая `auth`: тот бакет заведён под
 * инцидент 2026-08-08 как единственный свидетель «подпись пустая, экран-тупик»,
 * и подмешивать к нему сбои выписки значило бы сделать ту метрику тише, а не
 * громче.
 */
export const LOGIN_TICKET_SECTION = 'login.ticket';

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
// Подряд идущие ошибки опроса разводим по времени: за общим NAT сотня
// контейнеров, опрашивающих в одном ритме, выбирает лимит адреса (опрос
// анонимный, бакет — IP), сервер отвечает 429, и фиксированный повтор так и
// упирается в 429 до самого дедлайна — человек подтвердил вход, а экран
// показывает «истекло» (разбор 2026-08-31, RFC 8628 slow_down). Пауза растёт
// вдвое на каждую ошибку и гаснет на первом удачном ответе.
const MAX_BACKOFF_STEPS = 5; // потолок 2^5 = 32× базовой паузы

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
  // Поколение опроса. Каждый `begin`/`stop` его сдвигает, а все асинхронные
  // продолжения (после `await start`, каждый `tick`) сверяются с ним и молча
  // уходят, если поколение уже не их. Иначе два наложившихся `begin` (двойной
  // тап, перезапуск эффекта) завели бы ДВА цикла опроса: `stop` гасит один
  // таймер, но у второго цикла свой билет и своё продолжение — оно бы
  // пересоздавало таймер и жило параллельно (разбор 2026-08-31).
  const gen = useRef(0);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    gen.current++;
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
      const myGen = gen.current; // это поколение опроса; чужое молча уходит
      setState({ kind: 'starting', provider });
      let ticket;
      const d = depsRef.current;
      try {
        ticket = await d.api.start({
          intent: d.intent ?? 'login',
          provider,
          hostId: d.hostId,
        });
      } catch {
        // Текст ошибки не пересылаем: он приходит от браузера и может нести
        // адрес с секретом во фрагменте (правило №7 и разбор H0). Факта
        // достаточно — экран и так один.
        d.reportError?.({
          message: 'login ticket start failed',
          section: LOGIN_TICKET_SECTION,
        });
        if (alive.current && gen.current === myGen)
          setState({ kind: 'failed' });
        return null;
      }
      // Пока ждали билет, мог начаться новый вход — тогда этот уже не наш.
      if (!alive.current || gen.current !== myGen) return null;

      const url = (d.urlFor ?? loginUrl)(provider, ticket.userCode, d);
      setState({ kind: 'waiting', provider, code: ticket.userCode, url });
      // Контейнер без обычных ссылок (мини-апп) уводит наружу сам — но ТОЛЬКО
      // после setState: иначе при отказе открыть окно человек остался бы на
      // экране без кода, то есть без запасного пути.
      d.openExternally?.(url);

      const baseMs = Math.max(ticket.interval || 0, MIN_INTERVAL_S) * 1000;
      const deadline = Date.now() + ticket.expiresIn * 1000;
      let errors = 0; // подряд идущие ошибки опроса → длиннее пауза

      const schedule = () => {
        const delay = baseMs * 2 ** Math.min(errors, MAX_BACKOFF_STEPS);
        timer.current = setTimeout(() => void tick(), delay);
      };

      const tick = async () => {
        if (!alive.current || gen.current !== myGen) return;
        if (Date.now() > deadline) {
          setState({ kind: 'expired' });
          return;
        }
        let res;
        try {
          res = await depsRef.current.api.poll(ticket.deviceCode);
        } catch {
          // Сеть моргнула или сервер притормозил (429) — это не отказ во входе.
          // Отступаем и ждём: человек в этот момент подтверждает вход в другом
          // приложении. Фиксированный повтор упёрся бы в 429 до дедлайна.
          if (alive.current && gen.current === myGen) {
            errors++;
            schedule();
          }
          return;
        }
        if (!alive.current || gen.current !== myGen) return;
        errors = 0; // сервер ответил — сбрасываем отступ
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
        schedule();
      };

      schedule();
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
