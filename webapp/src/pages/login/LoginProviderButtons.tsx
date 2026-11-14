import { useEffect, useRef, useState } from 'react';
import { createLoginTicketApi, type LoginProvider } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { reportClientError } from '../../api';
import { isStandalone } from '../../../../shared/src/host/web';
import { maxLoginLink } from '../../../../shared/src/host/startParam';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { maxBotUsername } from '../../utils/botConfig';
import { MaxLoginStep } from './MaxLoginStep';
import '../../styles/auth-login.css';

// Вход через ВКонтакте, Яндекс и MAX. Кнопки Telegram здесь нет с 2026-11: запрос
// Роскомнадзора (п. 4 ч. 10 ст. 8 149-ФЗ) — пользователей из России нельзя
// авторизовать на сайте через иностранный сервис. Ни ссылки в бота, ни
// перехода на oauth.telegram.org; тем, кто входил через Telegram, путь
// называет LoginFormerNote. Возвращать кнопку нельзя.
//
// Билет (общий хук shared/src/auth/useLoginTicket, правило №3) нужен только
// установленному приложению: оно не видит куку браузера, поэтому вход
// открывается снаружи, а сессию приложение забирает опросом. Во вкладке кука
// общая — прямой вход в той же вкладке, без экрана «это вы?» с кодом (2026-10-03).
// Билет один на оба сервиса: его подтверждает уже вошедший человек на
// /auth/confirm, и каким сервисом он вошёл, серверу не важно.
// MAX — всегда билет, и во вкладке: OAuth для сайтов у MAX нет, вход
// подтверждают в мини-приложении, а сессию вкладка забирает опросом.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const api = createLoginTicketApi(API_BASE);
// Прямой вход во вкладке. Адреса — литералами: по ним потребителя маршрута
// находит сверка src/auth/providers/registry-consumers.spec.ts.
const DIRECT = { vk: `${API_BASE}/api/auth/vk`, yandex: `${API_BASE}/api/auth/yandex` } as const;
type OAuthId = keyof typeof DIRECT;
const ticketUrl = (p: LoginProvider, c: string, d: { apiBase: string }) =>
  p === 'max' ? maxLoginLink(maxBotUsername, c) : loginUrl(p, c, d);

export function LoginProviderButtons({
  onSession,
}: {
  onSession: (accessToken: string, expiresIn: number) => void;
}) {
  const standalone = isStandalone();
  const started = useRef(false);
  // Чью кнопку нажали — тот сервис называет ожидание и открывает «Открыть ещё раз».
  const [chosen, setChosen] = useState<OAuthId | 'max'>('vk');
  const { state, begin, reset } = useLoginTicket({
    api,
    hostId: 'web',
    apiBase: API_BASE,
    onSession,
    urlFor: ticketUrl,
    reportError: reportClientError,
  });
  // Билет MAX выписывает нажатие: код нужен ДО перехода, его набирают в MAX.
  const startMax = () => {
    setChosen('max');
    if (state.kind === 'starting' || (state.kind === 'waiting' && state.provider === 'max')) return;
    void begin('max');
  };
  const failed = state.kind === 'denied' || state.kind === 'expired' || state.kind === 'failed';

  // Билет выписывается при открытии экрана, а не по нажатию: иначе на ссылку
  // пришлось бы жать дважды — открыть окно после `await` браузеры блокируют.
  useEffect(() => {
    if (!standalone || started.current) return;
    started.current = true;
    void begin('vk');
  }, [begin, standalone]);

  if (failed || (standalone && state.kind === 'idle')) {
    // Билет сорвался (отказ, истечение, старт не прошёл): на месте кнопки — лист сбоя с повтором,
    // без эмодзи. Во вкладке билет бывает только у MAX — VK и Яндекс ведут на сервис напрямую.
    return (
      <LoginTicketWait state={state} onRetry={() => { reset(); void begin(chosen === 'max' ? 'max' : 'vk'); }} renderFailure={(f, onRetry) => (
        <PaperAlert title={f.text} sign={f.kind === 'denied' ? 'limits' : 'cup'} hue={f.kind === 'denied' ? 240 : 70}
                    onRetry={onRetry} retryLabel="Попробовать снова" className="al-alert" />
      )} />
    );
  }

  const code = state.kind === 'waiting' ? state.code : null;
  const urlFor = (id: OAuthId, c: string) => loginUrl(id, c, { apiBase: API_BASE });
  const oauthLink = (id: OAuthId) => standalone
    ? { href: code ? urlFor(id, code) : undefined, target: '_blank', rel: 'noopener noreferrer', onClick: () => setChosen(id) }
    : { href: DIRECT[id] };
  const maxWait = chosen === 'max' && state.kind === 'waiting' && state.provider === 'max' ? state : null;
  const waiting = state.kind === 'waiting' && chosen !== 'max' ? { ...state, provider: chosen, url: urlFor(chosen, state.code) } : state;

  return (
    <>
      {/* Знаки — цвета сервисов (VK #0077FF, Яндекс #FC3F1D, MAX — сине-фиолетовый), заданы в auth-login.css */}
      <a className="al-btn-main" {...oauthLink('vk')}>
        <span className="al-ico al-vk" aria-hidden="true">VK</span>
        Войти через ВКонтакте
      </a>
      <a className="al-btn-main" {...oauthLink('yandex')}>
        <span className="al-ico al-ya" aria-hidden="true">Я</span>
        Войти через Яндекс
      </a>
      {maxBotUsername ? (
        <button type="button" className="al-btn-main" onClick={startMax} disabled={state.kind === 'starting'}>
          <span className="al-ico al-max" aria-hidden="true">M</span>
          {state.kind === 'starting' && chosen === 'max' ? 'Готовлю код…' : 'Войти через MAX'}
        </button>
      ) : null}
      {maxWait ? <MaxLoginStep code={maxWait.code} url={maxWait.url} /> : null}
      {code && chosen !== 'max' ? <div className="al-ticket"><LoginTicketWait state={waiting} onRetry={reset} /></div> : null}
    </>
  );
}
