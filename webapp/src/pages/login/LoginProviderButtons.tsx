import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { botUsername } from '../../utils/botConfig';
import { reportClientError } from '../../api';
import { isStandalone } from '../../../../shared/src/host/web';
import '../../styles/auth-login.css';

// Вход по билету — та же механика, что у мини-аппа (правило №3 и «одна
// механика — один компонент»: общий хук в shared/src/auth/useLoginTicket).
//
// Для Telegram это заодно чинит «получается только со второй попытки»:
// `oauth.telegram.org` при первом визите в конкретный браузер требует телефон
// и код подтверждения — отдельный логин в Telegram Web, — а со второго раза у
// него уже стоит своя кука. Диплинк в бота ничего этого не просит и не зависит
// от привязки домена через /setdomain, которая однажды слетела и сломала вход
// у всех (инцидент 2026-08-21). Прежний путь остался ниже вторым способом.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const api = createLoginTicketApi(API_BASE);

const TelegramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#29B6F6" />
    <path
      d="M17.47 7.27 5.26 11.84c-.82.3-.81.72-.15.91l3.12.97 7.21-4.55c.34-.21.65-.1.4.13L9.7 14.6l-.2 3.29c.3 0 .43-.13.59-.28l1.41-1.37 2.93 2.16c.54.3.93.15 1.07-.5l1.93-9.1c.2-.8-.3-1.16-.96-.53z"
      fill="white"
    />
  </svg>
);

export function LoginProviderButtons({
  onSession,
}: {
  onSession: (accessToken: string, expiresIn: number) => void;
}) {
  const started = useRef(false);
  const { state, begin, reset } = useLoginTicket({
    api,
    hostId: 'web',
    botUsername,
    apiBase: API_BASE,
    onSession,
    reportError: reportClientError,
  });

  // Билет выписывается при открытии экрана, а не по нажатию: иначе на ссылку
  // пришлось бы жать дважды — открыть окно после `await` браузеры блокируют.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin('telegram');
  }, [begin]);

  if (state.kind !== 'waiting' && state.kind !== 'starting') {
    return (
      <LoginTicketWait
        state={state}
        onRetry={() => {
          reset();
          void begin('telegram');
        }}
      />
    );
  }

  const code = state.kind === 'waiting' ? state.code : null;
  const deps = { botUsername, apiBase: API_BASE };
  const href = (p: 'telegram' | 'vk') =>
    code ? loginUrl(p, code, deps) : undefined;
  // VK по билету — только из установленного приложения: оно не видит куку
  // браузера. Во вкладке кука общая — прямой вход в той же вкладке, без
  // экрана «это вы?» с кодом (2026-10-03).
  const vkLink = isStandalone()
    ? { href: href('vk'), target: '_blank', rel: 'noopener noreferrer' }
    : { href: `${API_BASE}/api/auth/vk` };

  return (
    <>
      {/* Telegram первым: это основной путь продукта и единственный, который
          сразу даёт тот же аккаунт, что в боте и мини-аппе. */}
      <a
        className="al-btn-main"
        href={href('telegram')}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="al-ico"><TelegramIcon /></span>
        Войти через Telegram
        <span className="al-badge">рекомендуем</span>
      </a>
      {/* VK — официальный брендовый цвет (#0077FF), задан в auth-login.css */}
      <a className="al-btn" {...vkLink}>
        <span className="al-ico al-vk">VK</span>
        Войти через ВКонтакте
      </a>
      {code ? <div className="al-ticket"><LoginTicketWait state={state} onRetry={reset} /></div> : null}
    </>
  );
}
