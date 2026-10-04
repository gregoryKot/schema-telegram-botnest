import { useState } from 'react';
import { EmailTokenConsume } from './authCallback/EmailTokenConsume';
import { HashCallback } from './authCallback/HashCallback';

// Две двери в одну страницу: ссылка из письма приходит с ?email_token=…
// (её погашает POST, а не GET — B-14), OAuth — с токеном во фрагменте.
export function AuthCallback() {
  // Запоминаем при первом рендере: EmailTokenConsume стирает токен из адреса.
  const [email] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const token = q.get('email_token');
    return token ? { token, ticket: q.get('ticket') } : null;
  });
  return email ? <EmailTokenConsume {...email} /> : <HashCallback />;
}
