// Интро-карточка: сервер, при ОШИБКЕ сети — localStorage; «пусто» от сервера авторитетно, локальная копия удаляется (E1).
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
  try {
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}
