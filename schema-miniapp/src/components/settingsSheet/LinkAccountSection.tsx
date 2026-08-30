// Перенос данных из аккаунта, который человек уже завёл на сайте. Механика
// общая с входом (правило «одна механика — один компонент»): билет выписывает
// useLoginTicket с intent='link', карточку рисует AccountLinkCard — здесь
// только сборка зависимостей и решение «показывать ли».
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getHost } from '../../../../shared/src/host';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import type { LoginProvider } from '../../../../shared/src/auth/loginTicketApi';
import {
  useLoginTicket,
  type LoginTicketState,
} from '../../../../shared/src/auth/useLoginTicket';
import { missingLinkTarget } from '../../../../shared/src/account/linkTarget';
import { AccountLinkCard } from '../../../../shared/src/components/AccountLinkCard';
import {
  ACCOUNT_LINK_FAILED_EVENT,
  ACCOUNT_LINK_STARTED_EVENT,
  type AccountLinkFailReason,
} from '../../../../shared/src/share/analytics';
import { api, reportClientError } from '../../api';
import { authedFetch } from '../../apiClient';
import { BASE } from '../../utils/apiBase';
import { adoptSession } from '../../session';
import { botUsername } from '../../utils/botConfig';
import { useTr } from '../../utils/addressForm';
import { SkeletonCard } from '../Skeleton';
import { Row, SettingsLabel } from './ui';

// Отказ считаем по причинам из allow-list (meta.reason): 'denied' туда не
// входит намеренно — человек сам сказал «это не я», механика сработала.
const FAIL_REASON: Partial<
  Record<LoginTicketState['kind'], AccountLinkFailReason>
> = { expired: 'expired', failed: 'error' };

const ticketApi = createLoginTicketApi(BASE, authedFetch);

export function LinkAccountSection() {
  const tr = useTr();
  const hostId = getHost().id;
  // null — ответа ещё нет; пустой список сервер вернуть не может, поэтому
  // сбой чтения тоже читается как «не знаем» (missingLinkTarget вернёт null).
  const [providers, setProviders] = useState<string[] | null>(null);
  const [asked, setAsked] = useState(false);

  const ticket = useLoginTicket({
    api: ticketApi,
    intent: 'link',
    hostId,
    botUsername,
    apiBase: BASE,
    // Подтверждают в браузере, а не в боте: у MAX входа для сайтов нет вовсе,
    // а Google запрещает OAuth во встроенных вебвью.
    urlFor: (_p, code) =>
      `${BASE || window.location.origin}/link?code=${encodeURIComponent(code)}`,
    openExternally: (url) => getHost().openLink(url),
    onSession: (token, expiresIn) => {
      adoptSession(token, expiresIn);
      // Перечитываем способы входа: сайт теперь привязан, и карточке пора
      // исчезнуть. Это и есть видимый человеку «готово».
      loadProviders();
    },
    reportError: reportClientError,
  });

  const loadProviders = useCallback(() => {
    let alive = true;
    api
      .getAuthProviders()
      .then((list) => alive && setProviders(list))
      .catch(() => alive && setProviders([]));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(loadProviders, [loadProviders]);

  const kind = ticket.state.kind;
  useEffect(() => {
    const reason = FAIL_REASON[kind];
    if (reason)
      api.trackEvent(ACCOUNT_LINK_FAILED_EVENT, { host: hostId, reason });
  }, [kind, hostId]);

  const target = missingLinkTarget({ providers, hostId, asked });
  // Мини-апп умеет тянуть данные только с сайта — 'telegram' как цель здесь
  // не появляется, поэтому источником переноса всегда служит сама площадка.
  const askable =
    missingLinkTarget({ providers, hostId, asked: true }) === 'site';

  const begin = () => {
    // Событие уходит ДО ухода в браузер: иначе «начал, но не дошёл» ничем не
    // отличается от «даже не пробовал».
    api.trackEvent(ACCOUNT_LINK_STARTED_EVENT, { host: hostId });
    void ticket.begin(hostId as LoginProvider);
  };

  // В Telegram обычный вход на сайте у человека есть — предлагать перенос
  // всем подряд незачем, карточка раскрывается по явному жесту. В MAX своего
  // входа для сайтов нет, там она появляется сама.
  if (hostId !== 'max' && !asked) {
    if (!askable) return null;
    return (
      <Frame pad={0}>
        <Row
          label="У меня уже есть аккаунт на сайте"
          onClick={() => setAsked(true)}
        />
      </Frame>
    );
  }
  const loading = providers === null;
  if (!loading && !target) return null;

  return (
    <Frame pad={14}>
      <AccountLinkCard
        target={target}
        state={ticket.state}
        tr={tr}
        onStart={begin}
        onRetry={ticket.reset}
        loading={loading}
        renderSkeleton={() => <SkeletonCard h={150} />}
      />
    </Frame>
  );
}

function Frame({ pad, children }: { pad: number; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ДАННЫЕ ИЗ ДРУГОГО АККАУНТА</SettingsLabel>
      <div
        className="card"
        style={{ borderRadius: 'var(--r-16)', padding: pad }}
      >
        {children}
      </div>
    </div>
  );
}
