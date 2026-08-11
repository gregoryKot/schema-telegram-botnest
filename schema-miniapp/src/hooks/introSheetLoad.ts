// Загрузка существующей интро-карточки: сервер, при провале — localStorage.
// Вынесено из useIntroSheetData.ts (правило №10, файл был у потолка).
export async function loadIntroSheetData<T extends Record<string, string>>(
  storageKey: string,
  loadExisting: () => Promise<T | null>,
): Promise<T | null> {
  try {
    const note = await loadExisting();
    if (note) return note;
  } catch (e) {
    console.error('loadExisting failed', e); // падаем на localStorage ниже
  }
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}
