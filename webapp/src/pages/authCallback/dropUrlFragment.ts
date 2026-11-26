// Фрагмент ссылки на страницах входа не читаем никогда (login-CSRF, аудит
// 2026-11): `#access_token=…` мог подбросить кто угодно — своим токеном он
// завёл бы жертву в свой аккаунт. Старые ссылки и подброшенное просто
// стираем, чтобы токен не осел в истории; сессию даёт только refresh по куке.
export function dropUrlFragment(): void {
  if (!window.location.hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', pathname + search);
}
