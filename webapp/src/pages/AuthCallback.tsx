import { lazy, Suspense, useState } from 'react';
import { HashCallback } from './authCallback/HashCallback';

// Две двери в одну страницу: ссылка привязки почты из письма приходит с
// ?email_token=… (её погашает POST, а не GET — B-14), OAuth — без токена
// (refresh-кука, 2026-11). Почтовый путь редкий, поэтому едет отдельным чанком.
const EmailTokenConsume = lazy(() =>
  import('./authCallback/EmailTokenConsume').then((m) => ({
    default: m.EmailTokenConsume,
  })),
);

export function AuthCallback() {
  // Запоминаем при первом рендере: EmailTokenConsume стирает токен из адреса.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('email_token'));
  if (!token) return <HashCallback />;
  return (
    <Suspense fallback={null}>
      <EmailTokenConsume token={token} />
    </Suspense>
  );
}
