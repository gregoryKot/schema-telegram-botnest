import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { ServiceLoading } from '../service/ServiceLoading';
import { dropUrlFragment } from './dropUrlFragment';

// Приём сессии после OAuth (Google, VK): сервер ставит httpOnly refresh-куку и
// ведёт на /auth/callback БЕЗ токена в адресе (до 2026-11 токен ехал во
// фрагменте — login-CSRF: чужая ссылка заводила в чужой аккаунт). Сессию
// поднимает AuthProvider refresh-ом при загрузке; здесь только ждём исход.
// Попап-ветки (токен в window.opener) нет: аудит 2026-10, E3.
export function HashCallback() {
  const { isLoading, isAuthenticated, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { dropUrlFragment(); }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      const returnTo = sessionStorage.getItem('auth_return_to') ?? '/today';
      sessionStorage.removeItem('auth_return_to');
      // returnTo можно вести за пределы SPA (/app/…, его ключ кладёт LoginScreen
      // перед OAuth): react-router там покажет пустоту — нужен полный переход.
      // Refresh уже завершён, новая кука в jar — следующая страница поднимет её сама.
      if (returnTo.startsWith('/app')) {
        window.location.replace(returnTo);
        return;
      }
      navigate(returnTo, { replace: true });
      return;
    }
    // Сеть/5xx: сессия, может быть, есть — AuthProvider ретраит сам, ждём его.
    if (authError === 'transient') return;
    navigate('/login?error=no_token', { replace: true });
  }, [isLoading, isAuthenticated, authError, navigate]);

  return (
    <ServiceLoading />
  );
}
