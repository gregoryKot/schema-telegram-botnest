// Текст подтверждения «Удалить клиента» — один на оба фронтенда (правило №3).
// removeClient на бэке стирает насовсем заметки по сессиям, концептуализацию
// и карты режимов терапевта. У виртуального (оффлайн) клиента, telegramId < 0,
// нет аккаунта: удаляется вся карточка вместе с заданиями. У клиента с
// аккаунтом его данные остаются у него, терапевт теряет доступ. Что обещает
// текст, делает removeClient (e2e therapy-remove-client). Тексты безличные.
import type { UserId } from '../userId';
import { isVirtualId } from '../utils/sameId';
export interface RemoveClientConfirmInput {
  telegramId: UserId;
  clientAlias?: string | null;
  name?: string | null;
}

export function removeClientConfirmCopy(client: RemoveClientConfirmInput): {
  title: string;
  message: string;
} {
  const name = client.clientAlias ?? client.name;
  const title = name ? `Удалить клиента «${name}»?` : 'Удалить клиента?';
  const message =
    isVirtualId(client.telegramId)
      ? 'Карточка, заметки по сессиям, концептуализация, карты режимов и задания удалятся насовсем. Вернуть их не получится.'
      : 'Заметки по сессиям, концептуализация и карты режимов удалятся насовсем. Дневники, оценки и задания останутся в аккаунте клиента, но доступ к ним закроется.';
  return { title, message };
}
