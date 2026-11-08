import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { ServicePage } from './service/ServicePage';
import { TicketDenied } from './service/TicketDenied';
import { TicketNotFound, ToAppLink } from './service/TicketNotFound';
import { TicketCodeField } from './service/TicketCodeField';
import { normalizeUserCode, userCodesMatch } from '../../../shared/src/auth/userCodeEntry';
import { momentTime } from '../../../shared/src/utils/momentDate';
import { useLoginPreview } from './service/useLoginPreview';
import { dropUrlFragment } from './authCallback/dropUrlFragment';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Экран сверки входа по билету — человек в цикле (разбор 2026-08-31).
//
// Раньше вход по билету на путях OAuth/письма сервер одобрял САМ, молча, в
// своём callback. Это дыра device-code phishing: код в `?ticket=` мог
// подставить кто угодно (выписка билета анонимна), и сервер отдавал сессию
// вошедшего тому, кто выписал билет. Бот от этого защищён — там человек видит
// код и жмёт «это я». Здесь тот же барьер для браузера: сюда попадает уже
// вошедший человек, видит код и подтверждает его СВОЕЙ сессией. Одобрить билет
// иначе, чем этим явным действием, теперь нельзя.
// S9 (аудит 2026-11): код из ссылки не подставляется готовым — человек
// набирает его с экрана приложения, и кнопка оживает только при совпадении.
type Phase = 'ask' | 'busy' | 'notfound' | 'denied';

export function AuthConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { getAccessToken, refreshToken } = useAuth();
  const tr = useTr();
  const code = params.get('code') ?? '';
  const [phase, setPhase] = useState<Phase>('ask');
  const [typed, setTyped] = useState('');
  const matches = userCodesMatch(typed, code);

  useEffect(() => {
    // Фрагмент не читаем (login-CSRF, аудит 2026-11): подброшенный
    // `#access_token=` одобрил бы билет ЧУЖОЙ сессией. Только стираем.
    dropUrlFragment();
    if (!code) navigate('/today', { replace: true });
  }, [code, navigate]);

  // Подтверждение — действие СВОЕЙ сессии этого браузера: refresh-кука из
  // редиректа OAuth или ответ POST письма. Ещё не поднята — refresh (общий
  // in-flight замок с AuthProvider, второй ротации не будет).
  const sessionToken = async (): Promise<string | null> =>
    getAccessToken() ?? ((await refreshToken()) ? getAccessToken() : null);
  const preview = useLoginPreview(matches ? normalizeUserCode(typed) : null, sessionToken);

  const call = async (path: string): Promise<boolean> => {
    const token = await sessionToken();
    if (!token) return false; // сессии нет — сервер всё равно отобьёт (JwtAuthGuard)
    const res = await fetch(`${API_BASE}/api/auth/ticket/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'webapp',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  };

  const confirm = async () => {
    if (phase === 'busy' || !matches) return;
    setPhase('busy');
    try {
      // Сеть могла моргнуть — тогда честнее показать «код не найдён / начни
      // заново», чем тихо оставить человека на кнопке: молчаливый провал и есть
      // тот класс багов, из-за которого «сохранено», а на деле нет.
      const ok = await call('confirm-login');
      if (ok) navigate('/today', { replace: true });
      else setPhase('notfound');
    } catch {
      setPhase('notfound');
    }
  };

  const deny = async () => {
    if (phase === 'busy') return;
    setPhase('busy');
    // Исход для человека один — «доступ никто не получил», — даже если запрос
    // не долетел: гасить билет со стороны нечем, но и врать «впустили» нельзя.
    try {
      await call('deny-login');
    } catch {
      // Сеть не долетела — билет истечёт сам через 5 минут; исход тот же.
      setPhase('denied');
      return;
    }
    setPhase('denied');
  };

  if (phase === 'notfound' || preview.kind === 'notfound') return <TicketNotFound />;
  if (phase === 'denied') return <TicketDenied><ToAppLink /></TicketDenied>;

  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Вход по коду</div>
        <h1 className="ds-h2">{tr('Это ты открываешь приложение?', 'Это вы открываете приложение?')}</h1>
        <p className="as-lead">
          {tr(
            'Набери код, который показан в приложении, откуда ты входишь.',
            'Наберите код, который показан в приложении, откуда вы входите.',
          )}
        </p>
        <TicketCodeField value={typed} onChange={setTyped} matches={matches} disabled={phase === 'busy'} />
        {preview.kind === 'ok' && <p className="as-lead">Устройство: <b>{preview.deviceLabel ?? 'не определилось'}</b>, запрошено в {momentTime(preview.createdAt)}</p>}
        <p className="as-lead">
          {tr(
            'Если кода перед тобой нет, вход начинал кто-то другой. Нажми «Это не я»: ссылку могли прислать, чтобы попасть в твой аккаунт.',
            'Если кода перед вами нет, вход начинал кто-то другой. Нажмите «Это не я»: ссылку могли прислать, чтобы попасть в ваш аккаунт.',
          )}
        </p>
        <div className="as-actions">
          <button type="button" onClick={confirm} disabled={phase === 'busy' || !matches || preview.kind === 'loading'} className="ds-btn">
            {phase === 'busy'
              ? tr('Впускаю…', 'Впускаю…')
              : tr('Да, это я — впустить', 'Да, это я — впустить')}
          </button>
          <button type="button" onClick={deny} disabled={phase === 'busy'} className="ds-btn ds-btn--secondary as-btn-deny">
            Это не я
          </button>
        </div>
      </div>
    </ServicePage>
  );
}
