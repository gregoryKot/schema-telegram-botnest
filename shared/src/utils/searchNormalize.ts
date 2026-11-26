// Сравнение русского текста «как человек читает»: регистр и «ё/е» не
// различаются. Один нормализатор на поиск (клиенты в списке, сайдбаре и
// палитре ⌘K) и на кризисную детекцию: QA 2026-11 — «Семен» не находил
// «Семёна», а нормализатор «ё→е» жил приватной копией в crisisMarkers.

/** Нижний регистр, «ё» → «е». */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

/** Есть ли запрос в тексте без учёта регистра и «ё/е»; пустой запрос подходит всем. */
export function matchesSearch(text: string, query: string): boolean {
  return normalizeSearchText(text).includes(normalizeSearchText(query.trim()));
}
