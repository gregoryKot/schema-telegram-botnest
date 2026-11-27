// Отметка согласия на входе сайта: галочка + редакция текста. После входа кабинет забирает её
// один раз (`takeLoginConsent`) и пишет на сервер. Без localStorage отметка живёт в памяти страницы.
const KEY = 'login_consent_given';
let mem: string | null = null;

export function rememberLoginConsent(version: string): void {
  mem = null;
  try { localStorage.setItem(KEY, version); } catch { mem = version; }
}

export function forgetLoginConsent(): void {
  mem = null;
  try { localStorage.removeItem(KEY); } catch { mem = null; }
}

/** Редакция, отмеченная на входе, или null; второй вызов вернёт null. */
export function takeLoginConsent(): string | null {
  try { return localStorage.getItem(KEY) ?? mem; } catch { return mem; } finally { forgetLoginConsent(); }
}
