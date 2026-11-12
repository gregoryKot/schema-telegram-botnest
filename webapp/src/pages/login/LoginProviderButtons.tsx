import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { botUsername } from '../../utils/botConfig';
import { reportClientError } from '../../api';
import { useGoogleOneTap } from '../../hooks/useGoogleOneTap';
import { isStandalone } from '../../../../shared/src/host/web';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { GoogleIcon, TelegramIcon } from './LoginBrandIcons';
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

  // Нативная всплывашка Google One Tap поверх кнопок: уже вошедшему в Google —
  // «Продолжить как …» одним касанием, без ухода на страницу Google. 2FA-аккаунт
  // уводим на ввод кода той же страницей, что и редирект-флоу.
  useGoogleOneTap({
    enabled: true,
    onSession,
    onTwofa: (token) =>
      window.location.assign(`/auth/2fa?token=${encodeURIComponent(token)}`),
    onError: reportClientError,
  });

  // Билет выписывается при открытии экрана, а не по нажатию: иначе на ссылку
  // пришлось бы жать дважды — открыть окно после `await` браузеры блокируют.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin('telegram');
  }, [begin]);

  const retry = () => {
    reset();
    void begin('telegram');
  };
  const code = state.kind === 'waiting' ? state.code : null;
  const deps = { botUsername, apiBase: API_BASE };
  const href = (p: 'telegram' | 'google' | 'vk') =>
    code ? loginUrl(p, code, deps) : undefined;
  // Google/VK по билету — только из установленного приложения: оно не видит
  // куку браузера. Во вкладке кука общая — прямой вход в той же вкладке, без
  // экрана «это вы?» с кодом (2026-10-03).
  const ticketed = isStandalone();
  const oauthLink = (p: 'google' | 'vk') =>
    ticketed
      ? { href: href(p), target: '_blank', rel: 'noopener noreferrer' }
      : { href: `${API_BASE}/api/auth/${p}` };

  const others = (
    <>
      {/* Google — официальные брендовые цвета логотипа, не токены продукта */}
      <a className="al-btn" {...oauthLink('google')}>
        <span className="al-ico"><GoogleIcon /></span>
        Войти через Google
      </a>
      {/* VK — официальный брендовый цвет (#0077FF), задан в auth-login.css */}
      <a className="al-btn" {...oauthLink('vk')}>
        <span className="al-ico al-vk">VK</span>
        Войти через ВКонтакте
      </a>
    </>
  );

  if (state.kind !== 'waiting' && state.kind !== 'starting') {
    // Билет сорвался (отказ, истечение, старт не прошёл): на месте Telegram — лист сбоя с повтором
    // у кнопок входа, без эмодзи. Google и ВКонтакте во вкладке билета не ждут — остаются видны; в
    // установленном приложении они ходят по билету, и без кода ссылке вести некуда (как раньше).
    return (
      <>
        <LoginTicketWait state={state} onRetry={retry} renderFailure={(f, onRetry) => (
          <PaperAlert title={f.text} sign={f.kind === 'denied' ? 'limits' : 'cup'} hue={f.kind === 'denied' ? 240 : 70}
                      onRetry={onRetry} retryLabel="Попробовать снова" className="al-alert" />
        )} />
        {!ticketed && others}
      </>
    );
  }

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
      {others}
      {code ? <div className="al-ticket"><LoginTicketWait state={state} onRetry={reset} /></div> : null}
    </>
  );
}
