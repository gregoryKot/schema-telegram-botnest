// Выход из мини-аппа для ВЕБ-хоста (установленный ярлык / вкладка на
// schemehappens.ru/app/). Там есть настоящая сессия (Bearer + refresh-кука,
// см. session.ts), а выйти из неё до этого было нельзя вовсе — человек входил
// потестить и застревал (разбор 2026-09-03). Внутри Telegram/MAX выхода нет и
// не нужно: вход по initData при каждом запуске (loginScreenGate.ts), поэтому
// кнопка «Выйти» показывается только на веб-хосте (LogoutSection).
import { postLogout } from '../../shared/src/auth/logout';
import { clearLocalData } from '../../shared/src/auth/clearLocalData';
import { clearApiCache } from '../../shared/src/api/apiCache';
import { BASE } from './utils/apiBase';
import { clearSession, markSessionExpired } from './session';

export async function logout(): Promise<void> {
  // Сначала гасим сессию на сервере, пока refresh-кука ещё уходит с запросом;
  // локальную чистку делаем всегда — даже если сеть легла (postLogout
  // best-effort), человек нажал «Выйти» и должен оказаться на экране входа.
  await postLogout(BASE, { requestedWith: 'miniapp' });
  clearSession();
  clearLocalData();
  clearApiCache();
  // Экран входа веб-хоста рисуется по этому событию (App.tsx →
  // useSessionExpired → shouldShowLoginScreen). Мгновенно, без перезагрузки:
  // вход обратно уже делает reload сам (loginScreen/LoginProviderButtons).
  markSessionExpired();
}
