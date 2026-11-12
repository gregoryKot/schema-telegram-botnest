// Куда ведёт единственная кнопка 404 (NotFoundPage): гостю — на главную, вошедшему — в приложение.
// Отдельный файл: модуль страницы экспортирует только компоненты (react-refresh).
export function notFoundExit(isAuthenticated: boolean): { to: string; label: string } {
  return isAuthenticated ? { to: '/today', label: 'В приложение' } : { to: '/', label: 'На главную' };
}
