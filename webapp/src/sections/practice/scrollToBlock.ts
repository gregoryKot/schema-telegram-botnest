// Переход к блоку страницы «Практики»: верхний ряд (PracticeTopRow) и строка
// «Здесь и сейчас» в «В трудный момент» ведут к быстрым практикам одним путём.
export const scrollToBlock = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
