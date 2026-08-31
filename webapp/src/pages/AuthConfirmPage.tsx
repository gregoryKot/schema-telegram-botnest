import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { formatUserCode } from '../../../shared/src/auth/loginTicketCode';

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
type Phase = 'ask' | 'busy' | 'notfound' | 'denied';

export function AuthConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const tr = useTr();
  const code = params.get('code') ?? '';
  const [phase, setPhase] = useState<Phase>('ask');
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Токен приезжает во фрагменте (redirect OAuth/письма). Забираем сессию
    // ЗДЕСЬ: подтверждение билета — авторизованное действие, и без сессии его
    // сервер отобьёт. Фрагмент затем чистим, чтобы токен не осел в истории.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    const expiresIn = parseInt(hash.get('expires_in') ?? '900', 10);
    if (token) {
      tokenRef.current = token;
      setAccessToken(token, expiresIn);
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (!code) navigate('/today', { replace: true });
  }, [code, navigate, setAccessToken]);

  const call = async (path: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/auth/ticket/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'webapp',
        ...(tokenRef.current
          ? { Authorization: `Bearer ${tokenRef.current}` }
          : {}),
      },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  };

  const confirm = async () => {
    if (phase === 'busy') return;
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

  const wrap: React.CSSProperties = {
    paddingTop: 80,
    paddingBottom: 80,
    maxWidth: 420,
    margin: '0 auto',
  };

  if (phase === 'notfound') {
    return (
      <div className="page-inner-wide" style={wrap}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 14 }}>
          Код не найден
        </h1>
        <div className="text-md muted" style={{ lineHeight: 1.6 }}>
          {tr(
            'Возможно, времени прошло слишком много или код уже использован. Открой вход в приложении заново.',
            'Возможно, времени прошло слишком много или код уже использован. Откройте вход в приложении заново.',
          )}
        </div>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="page-inner-wide" style={wrap}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 14 }}>
          Доступ никто не получил
        </h1>
        <div className="text-md muted" style={{ lineHeight: 1.6 }}>
          {tr(
            'Если этот код пришёл со стороны, всё правильно — подтверждать его не стоило.',
            'Если этот код пришёл со стороны, всё правильно — подтверждать его не стоило.',
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner-wide" style={wrap}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Вход по коду
      </div>
      <h1
        style={{
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        {tr('Это ты открываешь приложение?', 'Это вы открываете приложение?')}
      </h1>
      <div
        className="text-md muted"
        style={{ lineHeight: 1.6, marginBottom: 8 }}
      >
        {tr(
          'Сверь код с тем, что показан в приложении, откуда ты входишь.',
          'Сверьте код с тем, что показан в приложении, откуда вы входите.',
        )}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 3,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          margin: '10px 0 20px',
        }}
      >
        {formatUserCode(code)}
      </div>
      <div
        className="text-sm muted"
        style={{ lineHeight: 1.6, marginBottom: 24 }}
      >
        {tr(
          'Если это не ты открываешь приложение — нажми «Это не я»: кто-то мог прислать этот код, чтобы попасть в твой аккаунт.',
          'Если это не вы открываете приложение — нажмите «Это не я»: кто-то мог прислать этот код, чтобы попасть в ваш аккаунт.',
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-12)',
        }}
      >
        <button
          type="button"
          onClick={confirm}
          disabled={phase === 'busy'}
          className="btn btn-primary"
        >
          {phase === 'busy'
            ? tr('Впускаю…', 'Впускаю…')
            : tr('Да, это я — впустить', 'Да, это я — впустить')}
        </button>
        <button
          type="button"
          onClick={deny}
          disabled={phase === 'busy'}
          className="btn"
          style={{ color: 'var(--c-rose)' }}
        >
          Это не я
        </button>
      </div>
    </div>
  );
}
