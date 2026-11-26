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

const WORD_MARK = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
/** Первые буквы двух первых слов, заглавными; скобки и тире — не буква («Ира (пятница)» → «ИП», а не «И(»); пусто → «?». */
export function clientInitials(name: string): string {
  const marks = name.split(/\s+/).flatMap((w) => w.match(WORD_MARK) ?? []);
  return marks.slice(0, 2).join('').toUpperCase() || '?';
}
