import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

// Handles redirect from backend after OAuth (Google, VK, Telegram widget).
// Backend redirects to /auth/callback#access_token=...&expires_in=...
//
// Попап-ветки (токен в window.opener.location) здесь больше нет: вход
// Telegram идёт полным редиректом (backend telegram/redirect), окон
// window.open для входа в проекте не осталось. Ветка передавала токен в
// чужое окно без проверки источника (аудит 2026-10, E3).
export function AuthCallback() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') ?? '900', 10);

    window.history.replaceState(null, '', '/auth/callback');

    if (token) {
      const returnTo = sessionStorage.getItem('auth_return_to') ?? '/today';
      sessionStorage.removeItem('auth_return_to');
      // flushSync forces the state update to complete synchronously before
      // navigate() — otherwise RequireAuth renders with isAuthenticated=false
      // and immediately redirects to /login.
      flushSync(() => setAccessToken(token, expiresIn));
      // returnTo можно вести за пределы SPA сайта — на мини-апп (/app/…),
      // куда LoginScreen положил этот же ключ ПЕРЕД уходом на OAuth. У сайта
      // нет роута /app — react-router-навигация там покажет пустую страницу.
      // Полный переход отдаёт /app/ мини-аппу; сессия уже есть — refresh-кука
      // выдана бэкендом на path=/api/auth, мини-апп поднимет её POST /api/auth/refresh.
      if (returnTo.startsWith('/app')) {
        window.location.replace(returnTo);
        return;
      }
      navigate(returnTo, { replace: true });
    } else {
      navigate('/login?error=no_token', { replace: true });
    }
  }, [navigate, setAccessToken]);

  return (
    <div className="loader-center">
      <div className="spinner" />
    </div>
  );
}
