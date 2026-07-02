/**
 * Normalise a base URL from env into a fully-qualified https origin.
 *
 * Telegram inline URL buttons and Robokassa return URLs both require a scheme.
 * If APP_URL is configured as a bare domain (e.g. "schemehappens.ru"), a URL
 * like "schemehappens.ru/donate" is invalid and Telegram rejects the whole
 * sendMessage (BUTTON_URL_INVALID) — which breaks /about, /donate, the welcome
 * keyboard, etc. Prepending https:// keeps everything working regardless of how
 * the env value is written. Trailing slash is stripped.
 */
export function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? '').trim() || fallback;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/$/, '');
}
