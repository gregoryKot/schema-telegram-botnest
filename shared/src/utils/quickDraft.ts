// Черновик «Дневника одной страницей» (простой клиент, этап 3): один текст в localStorage.
// Отдельно от drafts.ts (там DRAFT_KEYS по типам дневника): это не тип, а общий вход,
// который потом превращается в запись схем, режимов или благодарности.
export const QUICK_DRAFT_KEY = 'diary_draft_quick';

/** Best-effort: хранилище может быть закрыто (приватное окно) — тогда false, экран работает без черновика. */
export function saveQuickDraft(text: string): boolean {
  try {
    if (text.trim()) localStorage.setItem(QUICK_DRAFT_KEY, text);
    else localStorage.removeItem(QUICK_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadQuickDraft(): string {
  try {
    return localStorage.getItem(QUICK_DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearQuickDraft(): boolean {
  try {
    localStorage.removeItem(QUICK_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}
