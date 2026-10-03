// Текст подтверждения «Удалить клиента» — один на оба фронтенда (правило №3).
// removeClient на бэке стирает насовсем заметки по сессиям, концептуализацию
// и карты режимов терапевта. У виртуального (оффлайн) клиента, telegramId < 0,
// нет аккаунта: удаляется вся карточка вместе с заданиями. У клиента с
// аккаунтом его собственные данные остаются в его аккаунте, терапевт теряет
// доступ. Что обещает текст, должен делать removeClient: сверка — e2e
// test/therapy-remove-client.e2e-spec.ts.
// Тексты безличные — без ты/вы и без рода, разводить формы не нужно.
export interface RemoveClientConfirmInput {
  telegramId: number;
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
    client.telegramId < 0
      ? 'Карточка, заметки по сессиям, концептуализация, карты режимов и задания удалятся насовсем. Вернуть их не получится.'
      : 'Заметки по сессиям, концептуализация и карты режимов удалятся насовсем. Дневники, оценки и задания останутся в аккаунте клиента, но доступ к ним закроется.';
  return { title, message };
}
