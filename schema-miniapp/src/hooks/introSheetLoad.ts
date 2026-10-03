// Загрузка интро-карточки: сервер, при ОШИБКЕ сети — localStorage. «Пусто» от сервера
// авторитетно: локальная копия (после смены аккаунта — чужая) удаляется (E1, аудит 2026-10).
export async function loadIntroSheetData<T extends Record<string, string>>(
  storageKey: string,
  loadExisting: () => Promise<T | null>,
): Promise<T | null> {
  try {
    const note = await loadExisting();
    if (!note) localStorage.removeItem(storageKey);
    return note;
  } catch (e) {
    console.error('loadExisting failed', e); // падаем на localStorage ниже
  }
  const stored = localStorage.getItem(storageKey);
  try { return stored ? (JSON.parse(stored) as T) : null; } catch { return null; }
}
