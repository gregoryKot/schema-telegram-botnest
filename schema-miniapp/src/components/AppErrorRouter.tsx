// Какой экран показать, когда приложение не смогло стартовать или сессия
// протухла посреди работы. Вынесено из App.tsx (700 строк, замороженный
// долг — правило №10 CLAUDE.md): сам выбор — чистая `pickErrorScreen`, здесь
// только его подключение к экранам.
//
// Инцидент 31.08.2026: авария БД — каждый запрос отвечал 500, включая
// /api/auth/refresh. Клиент верно решил «временно, сессия жива», но запрос
// данных без Bearer получил 401 ДО обращения к базе, и по подстроке «401»
// экран нарисовал «Не удалось войти» с советом переоткрыть Telegram —
// владельцу ярлычного приложения, где Telegram ни при чём. Теперь тот же
// 401 после временной неудачи refresh — «сервер не отвечает» с «Повторить».
import { useCallback } from 'react';
import { ConnectionTrouble } from '../../../shared/src/components/ConnectionTrouble';
import { AppErrorScreen } from './AppErrorScreen';
import { LoginScreen } from './LoginScreen';
import {
  isSessionDead,
  lastRenewFailure,
  renewSession,
  SESSION_EXPIRED_ERROR,
} from '../session';
import { shouldShowLoginScreen } from '../utils/loginScreenGate';
import { pickErrorScreen } from '../utils/pickErrorScreen';

interface Props {
  /** Текст ошибки начальной загрузки, как его поймал App.tsx. */
  error: string | null;
  /** Сессия умерла посреди работы (событие session-expired). */
  sessionExpired: boolean;
}

export function AppErrorRouter({ error, sessionExpired }: Props) {
  // «Повторить» на экране «сервер не отвечает»: перевыпуск сессии и полный
  // релоад — как «Повторить» в AppErrorScreen для сетевых ошибок.
  const retryConnection = useCallback(() => {
    void renewSession().then((ok) => ok && window.location.reload());
  }, []);

  const errMsg = sessionExpired ? SESSION_EXPIRED_ERROR : (error ?? '');
  const screen = pickErrorScreen(
    errMsg,
    sessionExpired || isSessionDead(),
    lastRenewFailure(),
    shouldShowLoginScreen(),
  );
  // В браузере отсутствие сессии значит «не входил», а не «истекла» —
  // экран входа. В Telegram/MAX поведение прежнее (utils/loginScreenGate.ts).
  if (screen === 'login') return <LoginScreen />;
  if (screen === 'connection')
    return <ConnectionTrouble onRetry={retryConnection} />;
  return <AppErrorScreen error={errMsg} />;
}
