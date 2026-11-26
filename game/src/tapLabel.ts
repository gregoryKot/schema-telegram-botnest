// Знак Press Start 2P = 1em: в кнопке действия (76px внутри рамки) кеглем 10px влезает 7 знаков,
// подпись длиннее получает класс long — 8px (.tbtn.act.long в game/index.html).
export const isLongTapLabel = (label: string): boolean => label.length > 7;
