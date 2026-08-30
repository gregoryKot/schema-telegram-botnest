import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { botUsername } from '../../utils/botConfig';
import { reportClientError } from '../../api';

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

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

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
  const href = (p: 'telegram' | 'google' | 'vk') =>
    code ? loginUrl(p, code, deps) : undefined;

  return (
    <>
      {/* Telegram первым: это основной путь продукта и единственный, который
          сразу даёт тот же аккаунт, что в боте и мини-аппе. */}
      <a
        className="btn-outline"
        href={href('telegram')}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginBottom: 8 }}
      >
        <TelegramIcon />
        Войти через Telegram
      </a>
      {/* Google — официальные брендовые цвета логотипа, не токены продукта */}
      <a
        className="btn-outline"
        href={href('google')}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginBottom: 8 }}
      >
        <GoogleIcon />
        Войти через Google
      </a>
      {/* VK — официальный брендовый цвет (#0077FF), не токен продукта */}
      <a
        className="btn-outline"
        href={href('vk')}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginBottom: 12 }}
      >
        <span
          style={{
            background: '#0077FF',
            color: 'white',
            borderRadius: 'var(--r-4)',
            padding: '1px 6px',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          VK
        </span>
        Войти через ВКонтакте
      </a>
      {code ? <LoginTicketWait state={state} onRetry={reset} /> : null}
    </>
  );
}
