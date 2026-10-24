// Карточка «данные из Telegram лежат отдельно» в кабинете сайта.
//
// Своей механики тут нет: билет, тексты, разметка и решение «кому вообще
// показывать» живут в shared и общие с мини-аппом (правило №3 и «одна
// механика — один компонент»). Здесь — только то, что у сайта своё: сессия
// webapp, ссылка в бота и событие аналитики.
import { useEffect, useRef, useState } from 'react';
import {
  createLoginTicketApi,
  type LoginProvider,
} from '../../../../shared/src/auth/loginTicketApi';
import {
  useLoginTicket,
  type LoginTicketState,
} from '../../../../shared/src/auth/useLoginTicket';
import { AccountLinkCard } from '../../../../shared/src/components/AccountLinkCard';
import { missingLinkTarget } from '../../../../shared/src/account/linkTarget';
import { ACCOUNT_LINK_STARTED_EVENT } from '../../../../shared/src/share/analytics';
import { api, reportClientError } from '../../api';
import { authedFetch } from '../../apiClient';
import { API_BASE } from '../../utils/apiBase';
import { botUsername } from '../../utils/botConfig';
import { useAuth } from '../../auth/authContext';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../../components/Skeleton';
import type { AccountProvider } from './ProviderRows';

// authedFetch, а не голый fetch: intent 'link' сервер без сессии отбивает —
// привязывать было бы не к чему.
const ticketApi = createLoginTicketApi(API_BASE, authedFetch);

/** Силуэт будущей карточки: заголовок, два абзаца и кнопка (не спиннер). */
function CardSkeleton() {
  return (
    <>
      <Skeleton width="45%" height={18} />
      <Skeleton width="92%" height={12} style={{ marginTop: 12 }} />
      <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
      <Skeleton width={190} height={44} radius={12} style={{ marginTop: 16 }} />
    </>
  );
}

export function AccountLinkSection({
  providers,
  loading = false,
  onLinked,
}: {
  providers: AccountProvider[];
  /** Провайдеры ещё грузятся — карточка показывает силуэт, а не пустоту. */
  loading?: boolean;
  /** Аккаунты объединились — странице пора перечитать способы входа. */
  onLinked: () => void;
}) {
  const tr = useTr();
  const { setAccessToken } = useAuth();
  // Нажатие открывает бота в новой вкладке, и только после него уместен экран
  // сверки кода: до нажатия сверять не с чем — бот ещё не открыт.
  const [opened, setOpened] = useState(false);

  const target = loading
    ? null
    : missingLinkTarget({
        providers: providers.map((p) => p.provider),
        hostId: 'web',
      });

  // `provider` у билета привязки означает провайдера ИСТОЧНИКА — того
  // аккаунта, чьи данные переедут (ticket-link.service ищет по нему строку
  // AuthProvider и показывает подтверждающему, чей аккаунт объединяется).
  // Источник здесь — сам веб-аккаунт, поэтому берём его способ входа, а не
  // 'telegram': тот принадлежит подтверждающей стороне.
  const sourceProvider = (providers.find((p) =>
    ['google', 'vk', 'email'].includes(p.provider),
  )?.provider ?? 'email') as LoginProvider;

  const { state, begin, reset } = useLoginTicket({
    api: ticketApi,
    hostId: 'web',
    botUsername,
    apiBase: API_BASE,
    intent: 'link',
    urlFor: (_provider, code) =>
      `https://t.me/${botUsername}?start=link_${code}`,
    onSession: (token, expiresIn) => {
      setAccessToken(token, expiresIn);
      onLinked();
    },
    reportError: reportClientError,
  });

  // Билет выписывается при показе карточки, а не по нажатию: открыть окно
  // после `await` браузеры блокируют, поэтому кнопка обязана быть настоящей
  // ссылкой с готовым адресом (тот же приём, что в LoginProviderButtons).
  const started = useRef(false);
  useEffect(() => {
    if (!target || started.current) return;
    started.current = true;
    void begin(sourceProvider);
  }, [target, begin, sourceProvider]);

  const broken =
    state.kind === 'denied' ||
    state.kind === 'expired' ||
    state.kind === 'failed';
  // Сбой выписки (в том числе 429 от троттлинга) — это `failed`, и карточка
  // сама предложит «Начать заново»; ловить его отдельно не надо.
  const pending = !broken && state.kind !== 'waiting';
  const href = state.kind === 'waiting' ? state.url : undefined;

  if (!loading && !target) return null;

  return (
    <div className="card-elevated" style={{ padding: 20, marginBottom: 16 }}>
      <AccountLinkCard
        target={target}
        state={
          opened || broken ? state : ({ kind: 'idle' } as LoginTicketState)
        }
        tr={tr}
        loading={loading || pending}
        renderSkeleton={() => <CardSkeleton />}
        href={href}
        onStart={() => {
          api.trackEvent(ACCOUNT_LINK_STARTED_EVENT, { host: 'web' });
          setOpened(true);
        }}
        onRetry={() => {
          setOpened(false);
          reset();
          started.current = true;
          void begin(sourceProvider);
        }}
      />
    </div>
  );
}
