// Инициалы клиента для аватара — одна функция на кабинет терапевта: «Сегодня»,
// список клиентов, шапка карточки и сайдбар. QA 2026-11: сайдбар резал имя
// `slice(0, 2)` («Анна Крылова» → «АН»), а три правильные копии жили по модулям.

/** Первые буквы двух первых слов имени, заглавными; пустое имя → «?», «#123» → «#». */
export function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase());
  return letters.join('') || '?';
}
