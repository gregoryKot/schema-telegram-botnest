// Загрузка существующей интро-карточки: сервер, при ОШИБКЕ сети — localStorage.
//
// Аудит 2026-10, E1: раньше фолбэк срабатывал и когда сервер уверенно отвечал
// «карточки нет» (null). После смены аккаунта на устройстве там лежал текст
// прежнего пользователя: он показывался новому и автосохранением записывался
// в его аккаунт. Теперь «сервера нет» и «сервер сказал: пусто» — разные случаи.
// Вынесено из useIntroSheetData.ts (правило №10, файл был у потолка).
export async function loadIntroSheetData<T extends Record<string, string>>(
  storageKey: string,
  loadExisting: () => Promise<T | null>,
): Promise<T | null> {
  try {
    const note = await loadExisting();
    if (note) return note;
    // Авторитетное «пусто»: локальная копия — чужая или устаревшая, убираем.
    localStorage.removeItem(storageKey);
    return null;
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
