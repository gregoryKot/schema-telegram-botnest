// Страница уходит или прячется (pagehide, вкладка скрыта) — момент дослать
// отложенное. Одна подписка на всех, кто досылает: автосохранения
// (usePendingSave.ts) и настройки экранов (webapp UiPrefsGate, #922).
// Возвращает отписку.
export function onPageLeave(leave: () => void): () => void {
  const onPageHide = () => leave();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') leave();
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
