import { emailLinkErrorMessage } from './emailLinkError';

/** Что сказать у строки Email после возврата по ссылке из письма: отказ, успех или ничего. */
export interface EmailLinkNotice { kind: 'ok' | 'error'; text: string }

// b27: успех (?linked=email) и отказ (?error=…) показываются у строки Email, а не баннером над страницей.
export function emailLinkNotice(
  linked: string | null,
  error: string | null,
  tr: (ty: string, vy: string) => string,
): EmailLinkNotice | null {
  const failed = emailLinkErrorMessage(error, tr);
  if (failed) return { kind: 'error', text: failed };
  return linked === 'email' ? { kind: 'ok', text: 'Email успешно привязан' } : null;
}
