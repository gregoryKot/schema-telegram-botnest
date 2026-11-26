import { contactLabelOr } from './contact-channel';

// Чистые функции заявки с формы знакомства (POST /api/booking): нормализация
// того, что пришло с сайта, и тексты уведомлений админу. Вынесено из контроллера:
// тот же текст нужен при первой отправке, при отправке «не сохранилась в базе»
// и при повторе доставки кроном.

export interface IntroLeadInput {
  name?: string;
  contact?: string;
  channel?: string;
  message?: string;
  source?: string;
}

/** Заявка после нормализации: trim, пустое = null. Длину не режем: предел — в DTO (400), тихая обрезка запрещена #671. */
export interface IntroLeadFields {
  name: string;
  contact: string;
  channel: string | null;
  message: string | null;
  source: string | null;
}

/** null — нет имени или контакта: молчаливый дроп (обязательность проверяет фронт). */
export function normalizeIntroLead(
  dto: IntroLeadInput,
): IntroLeadFields | null {
  const name = dto.name?.trim();
  const contact = dto.contact?.trim();
  if (!name || !contact) return null;
  return {
    name,
    contact,
    channel: dto.channel ?? null,
    message: dto.message?.trim() || null,
    source: dto.source?.trim() || null,
  };
}

/** Состояние заявки для пометки в уведомлении. */
export type IntroLeadMark = 'saved' | 'unsaved' | 'repeat';

export interface IntroLeadMessages {
  tg: string;
  subject: string;
  email: string;
}

const MARKS: Record<Exclude<IntroLeadMark, 'saved'>, [string, string]> = {
  unsaved: [
    '⚠️ <b>Не сохранилась в базе</b> — сбой сервера, связь с человеком — вручную.',
    '⚠️ Не сохранилась в базе — сбой сервера. Свяжитесь с человеком вручную.',
  ],
  repeat: [
    '🔁 <b>Повторная отправка</b> — первая не дошла.',
    '🔁 Повторная отправка — первая не дошла.',
  ],
};

/** Тексты DM (HTML) и письма (plain). DM — номер и пометка, данные человека — в письме; `id` null — строки нет. */
export function introLeadMessages(
  lead: IntroLeadFields,
  id: number | null,
  mark: IntroLeadMark = 'saved',
): IntroLeadMessages {
  const label = contactLabelOr(lead.channel, 'Контакт');
  const [tgMark, mailMark] = mark === 'saved' ? [null, null] : MARKS[mark];
  const tg = [
    `📩 <b>Новая заявка с сайта${id === null ? '' : ` #${id}`}</b>`,
    tgMark,
    '',
    '📧 Имя, контакт и запрос — в письме на почте.',
  ];
  const email = [
    'Новая заявка с сайта',
    mailMark,
    '',
    `Имя: ${lead.name}`,
    `${label}: ${lead.contact}`,
    lead.message ? `Запрос:\n${lead.message}` : null,
    lead.source ? `Откуда: ${lead.source}` : null,
  ];
  const join = (lines: (string | null)[]) =>
    lines.filter((l) => l !== null).join('\n');
  const suffix = {
    saved: '',
    unsaved: ' (не сохранилась в базе)',
    repeat: ' (повтор)',
  };
  return {
    tg: join(tg),
    subject: `📩 Новая заявка с сайта${suffix[mark]}`,
    email: join(email),
  };
}
