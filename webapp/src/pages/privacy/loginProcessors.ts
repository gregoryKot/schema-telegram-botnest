// Способы входа как получатели данных (глава 7 политики), по
// `src/auth/providers/{yandex,vk,max}.provider.ts`. Юрлица VK ID и MAX не подтверждены — `docs/open/owner.md`.
import type { Processor } from './processors';

export const YANDEX_ID_PROCESSOR: Processor = {
  name: 'Яндекс ID (ООО «Яндекс»)',
  purpose: 'вход на сайт через аккаунт Яндекса – только у тех, кто сам выбирает этот способ входа',
  data: 'сервис узнаёт о входе на сайт Оператора; Оператор получает от него идентификатор аккаунта, адрес электронной почты и имя',
};

export const VK_ID_PROCESSOR: Processor = {
  name: 'VK ID',
  purpose: 'вход на сайт через аккаунт VK – только у тех, кто сам выбирает этот способ входа',
  data: 'сервис узнаёт о входе на сайт Оператора; Оператор получает от него идентификатор аккаунта, адрес электронной почты и имя',
};

export const MAX_PROCESSOR: Processor = {
  name: 'Мессенджер MAX',
  purpose: 'работа приложения внутри MAX и вход в него – только у тех, кто открывает приложение в этом мессенджере',
  data: 'сервис узнаёт об открытии приложения Оператора; Оператор получает от него идентификатор пользователя MAX и имя',
};

export const LOGIN_PROCESSORS: readonly Processor[] = [YANDEX_ID_PROCESSOR, VK_ID_PROCESSOR, MAX_PROCESSOR];
