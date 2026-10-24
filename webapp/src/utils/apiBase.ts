// База API webapp. Ранее — копипастой в каждой странице (AccountPage, LoginPage,
// …); здесь единая точка. Постепенно мигрируем остальные страницы.
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';
