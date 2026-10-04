import { lazy, Suspense, useState } from 'react';
import { HashCallback } from './authCallback/HashCallback';

// Две двери в одну страницу: ссылка из письма приходит с ?email_token=…
// (её погашает POST, а не GET — B-14), OAuth — с токеном во фрагменте.
// Почтовый путь редкий, поэтому едет отдельным чанком, а не в стартовом.
const EmailTokenConsume = lazy(() =>
  import('./authCallback/EmailTokenConsume').then((m) => ({
    default: m.EmailTokenConsume,
  })),
);

export function AuthCallback() {
  // Запоминаем при первом рендере: EmailTokenConsume стирает токен из адреса.
  const [email] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const token = q.get('email_token');
    return token ? { token, ticket: q.get('ticket') } : null;
  });
  if (!email) return <HashCallback />;
  return (
    <Suspense fallback={null}>
      <EmailTokenConsume {...email} />
    </Suspense>
  );
}
