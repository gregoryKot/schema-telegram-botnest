// Ссылка входа Google (OAuth 2.0 Authorization Code flow) — отдельно от
// GoogleProvider, чтобы тем же кодом её строила проба самопроверки
// (src/infra/self-check/probe-oauth-providers.ts): проба обязана проверять
// ровно то, что шлёт прод, а не свою копию параметров.
//
// response_type=code → Google вернёт на redirect_uri с ?code=&state= обычным
// GET, код меняем на сервере. (Устаревший implicit flow — response_type=
// id_token + form_post — держался на куке SameSite=None, которую ломает
// отказ браузеров от сторонних кук, поэтому не используется.)
export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  forceChooser = false,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
  });
  // ВХОД: `prompt` не ставим. Google сам вернёт уже вошедшего одним касанием
  // («Continue as X»), а если аккаунтов несколько или сессии нет — покажет
  // выбор. Прежний хардкод `prompt=select_account` заставлял ЗАНОВО выбирать
  // аккаунт на каждый вход — это и читалось как «авторизация с нуля».
  // ПРИВЯЗКА второго аккаунта (forceChooser): выбор оставляем принудительным,
  // чтобы человек не прицепил случайно уже открытый в браузере Google вместо
  // нужного (разбор 2026-08-31).
  if (forceChooser) params.set('prompt', 'select_account');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
