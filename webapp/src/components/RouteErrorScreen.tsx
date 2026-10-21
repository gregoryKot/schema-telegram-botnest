import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '../api';
import { isChunkLoadError, reloadForFreshChunks } from '../utils/chunkReload';
import '../styles/sheet-tasks.css';

// Ошибка уровня маршрута (ленивая страница не догрузилась, падение вне
// разделов с ErrorBoundary). Без своего errorElement React Router рисует
// служебную страницу «Unexpected Application Error! Hey developer…» —
// её владелец увидел на iPhone 2026-10-19 после деплоя.

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(
    (error as { statusText?: string } | null)?.statusText ??
      'unknown route error',
  );
}

export function RouteErrorScreen() {
  const error = useRouteError();
  const message = messageOf(error);
  const chunk = isChunkLoadError(message);

  useEffect(() => {
    if (chunk) {
      reloadForFreshChunks();
      return;
    }
    reportClientError({
      message,
      section: 'route',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }, [chunk, message, error]);

  return (
    <div className="sk-crash">
      <div className="ds-card sk-crash-card">
        <h1 className="ds-h2">
          {chunk ? 'Страница устарела' : 'Что-то пошло не так'}
        </h1>
        <p className="sk-crash-text">
          {chunk
            ? 'Приложение обновилось — нужна свежая версия страницы.'
            : 'Ошибка уже отправлена разработчику. Обычно помогает перезагрузка.'}
        </p>
        <button className="ds-btn" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </div>
    </div>
  );
}
