import { AddressForm, t } from '../notification/address-form';

// Тексты magic-link писем. Живут отдельно от EmailService, чтобы тексты
// правились как контент (двухформенные, см. CLAUDE.md «Обращение ты/вы»),
// а сервис занимался только доставкой.

export interface Letter {
  subject: string;
  body: string;
}

export function loginLetter(form: AddressForm, link: string): Letter {
  return {
    subject: 'Войти во «Всё по схеме»',
    body: t(
      form,
      `Привет!\n\nПерейди по ссылке, чтобы войти во «Всё по схеме»:\n\n${link}\n\nСсылка действует 30 минут. Если запрос не от тебя — просто проигнорируй это письмо.`,
      `Здравствуйте!\n\nПерейдите по ссылке, чтобы войти во «Всё по схеме»:\n\n${link}\n\nСсылка действует 30 минут. Если запрос не от вас — просто проигнорируйте это письмо.`,
    ),
  };
}
