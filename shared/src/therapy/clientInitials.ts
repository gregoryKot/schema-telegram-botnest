// Имя клиента в кабинете терапевта — одна функция подписи и одна функция
// инициалов на «Сегодня», список клиентов, шапку карточки, сайдбар, поиск-палитру
// ⌘K и экспорт концептуализации. QA 2026-11: сайдбар резал имя `slice(0, 2)`
// («Анна Крылова» → «АН»), а три правильные копии жили по модулям; клиент без
// имени звался «#123» в двух местах и «ID 123» в трёх.
import type { UserId } from '../userId';

/** Что нужно от клиента для подписи: псевдоним терапевта, имя из аккаунта, id. */
export interface ClientNameSource {
  clientAlias?: string | null;
  name?: string | null;
  telegramId: UserId;
}

/** Подпись клиента, у которого нет ни псевдонима, ни имени. */
export const UNNAMED_CLIENT = 'Без имени';

const ownName = (c: ClientNameSource): string | null =>
  c.clientAlias?.trim() || c.name?.trim() || null;

/** Псевдоним → имя → «Без имени · 123». Номер различает двух безымянных; у
 *  офлайн-клиента id отрицательный — минус не показываем, как и бэкенд. */
export function clientDisplayName(c: ClientNameSource): string {
  return (
    ownName(c) ??
    `${UNNAMED_CLIENT} · ${String(c.telegramId).replace(/^-/, '')}`
  );
}

/** Инициалы для аватара: без имени — «?», а не буквы подписи «Без имени». */
export function clientAvatarInitials(c: ClientNameSource): string {
  return clientInitials(ownName(c) ?? '');
}

/** Первые буквы двух первых слов имени, заглавными; пустое имя → «?». */
export function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase());
  return letters.join('') || '?';
}
