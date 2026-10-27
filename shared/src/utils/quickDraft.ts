// Черновик «Дневника одной страницей» (простой клиент, этап 3): один текст в localStorage.
// Отдельно от drafts.ts (там DRAFT_KEYS по типам дневника): это не тип, а общий вход,
// который потом превращается в запись схем, режимов или благодарности.
export const QUICK_DRAFT_KEY = 'diary_draft_quick';

export function saveQuickDraft(text: string) {
  try {
    if (text.trim()) localStorage.setItem(QUICK_DRAFT_KEY, text);
    else localStorage.removeItem(QUICK_DRAFT_KEY);
  } catch {
    /* best-effort: ошибку намеренно игнорируем */
  }
}

export function loadQuickDraft(): string {
  try {
    return localStorage.getItem(QUICK_DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearQuickDraft() {
  try {
    localStorage.removeItem(QUICK_DRAFT_KEY);
  } catch {
    /* best-effort */
  }
}
