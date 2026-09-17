import { useEffect } from 'react';
import { api } from '../api';

// Пришли из установленного приложения: мини-апп на компьютере уводит в кабинет
// (schema-miniapp/src/utils/desktopLaunch.ts) и помечает переход `?from=app`.
// Здесь метку считаем и убираем из адреса — она техническая, показывать её
// человеку незачем, а в истории она мешала бы кнопке «назад».
//
// Событие шлём отсюда, а не перед уходом из мини-аппа: там страница
// выгружается и запрос не успевает уйти. Хук живёт внутри авторизованной
// части (AppShell), поэтому у trackEvent уже есть токен.
export const FROM_APP_PARAM = 'from';
export const FROM_APP_VALUE = 'app';

export function useDesktopAppLaunch(): void {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(FROM_APP_PARAM) !== FROM_APP_VALUE) return;
    api.trackEvent('desktop_app_open');
    url.searchParams.delete(FROM_APP_PARAM);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, []);
}
