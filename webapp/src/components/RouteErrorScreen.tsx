import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '../api';
import { isChunkLoadError, reloadForFreshChunks } from '../utils/chunkReload';
import { PaperOutcome } from './paper/PaperOutcome';
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

  // Служебный исход на всю страницу (PaperOutcome): устарел чанк — «обновилось» (Leaf на шалфее),
  // иначе — «на нашей стороне» (Breath на персике). Тексты прежние.
  return (
    <div data-crash-screen="route" className="sk-crash-route">
      <PaperOutcome
        outcome={chunk ? 'updated' : 'our_side'}
        title={chunk ? 'Страница устарела' : 'Что-то пошло не так'}
        lead={chunk
          ? 'Приложение обновилось — нужна свежая версия страницы.'
          : 'Ошибка уже отправлена разработчику. Обычно помогает перезагрузка.'}
        action={{ label: 'Обновить страницу', onClick: () => window.location.reload() }}
      />
    </div>
  );
}
