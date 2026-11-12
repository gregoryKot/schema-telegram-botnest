import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { reportClientError } from '../../api';
import { isStandalone } from '../../../../shared/src/host/web';
import { PaperAlert } from '../../components/paper/PaperAlert';
import '../../styles/auth-login.css';

// Вход через ВКонтакте. Кнопки Telegram здесь нет с 2026-11: запрос
// Роскомнадзора (п. 4 ч. 10 ст. 8 149-ФЗ) — пользователей из России нельзя
// авторизовать на сайте через иностранный сервис. Ни ссылки в бота, ни
// перехода на oauth.telegram.org; тем, кто входил через Telegram, путь
// называет LoginFormerNote. Возвращать кнопку нельзя.
//
// Билет (общий хук shared/src/auth/useLoginTicket, правило №3) нужен только
// установленному приложению: оно не видит куку браузера, поэтому вход
// открывается снаружи, а сессию приложение забирает опросом. Во вкладке кука
// общая — прямой вход в той же вкладке, без экрана «это вы?» с кодом (2026-10-03).

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const api = createLoginTicketApi(API_BASE);

export function LoginProviderButtons({
  onSession,
}: {
  onSession: (accessToken: string, expiresIn: number) => void;
}) {
  const standalone = isStandalone();
  const started = useRef(false);
  const { state, begin, reset } = useLoginTicket({
    api,
    hostId: 'web',
    apiBase: API_BASE,
    onSession,
    reportError: reportClientError,
  });

  // Билет выписывается при открытии экрана, а не по нажатию: иначе на ссылку
  // пришлось бы жать дважды — открыть окно после `await` браузеры блокируют.
  useEffect(() => {
    if (!standalone || started.current) return;
    started.current = true;
    void begin('vk');
  }, [begin, standalone]);

  if (standalone && state.kind !== 'waiting' && state.kind !== 'starting') {
    // Билет сорвался (отказ, истечение, старт не прошёл): на месте кнопки — лист сбоя с повтором,
    // без эмодзи. Во вкладке билета нет — кнопка ведёт на VK напрямую.
    return (
      <LoginTicketWait state={state} onRetry={() => { reset(); void begin('vk'); }} renderFailure={(f, onRetry) => (
        <PaperAlert title={f.text} sign={f.kind === 'denied' ? 'limits' : 'cup'} hue={f.kind === 'denied' ? 240 : 70}
                    onRetry={onRetry} retryLabel="Попробовать снова" className="al-alert" />
      )} />
    );
  }

  const code = state.kind === 'waiting' ? state.code : null;
  const vkLink = standalone
    ? {
        href: code ? loginUrl('vk', code, { apiBase: API_BASE }) : undefined,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : { href: `${API_BASE}/api/auth/vk` };

  return (
    <>
      {/* VK — официальный брендовый цвет (#0077FF), задан в auth-login.css */}
      <a className="al-btn-main" {...vkLink}>
        <span className="al-ico al-vk">VK</span>
        Войти через ВКонтакте
      </a>
      {code ? <div className="al-ticket"><LoginTicketWait state={state} onRetry={reset} /></div> : null}
    </>
  );
}
