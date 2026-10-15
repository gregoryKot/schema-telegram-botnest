import { escapeHtml } from '../utils/escape-html';
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

/** Заявка после нормализации: обрезано, trim, пустое = null. */
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
  const name = dto.name?.slice(0, 100).trim();
  const contact = dto.contact?.slice(0, 100).trim();
  if (!name || !contact) return null;
  return {
    name,
    contact,
    channel: dto.channel ?? null,
    message: dto.message?.slice(0, 500).trim() || null,
    source: dto.source?.slice(0, 200).trim() || null,
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
    '⚠️ <b>Не сохранилась в базе</b> — сбой сервера. Свяжитесь с человеком вручную.',
    '⚠️ Не сохранилась в базе — сбой сервера. Свяжитесь с человеком вручную.',
  ],
  repeat: [
    '🔁 <b>Повторная отправка</b> — первая не дошла.',
    '🔁 Повторная отправка — первая не дошла.',
  ],
};

/** Тексты DM (HTML) и письма (plain) по заявке. Поля экранируются только в DM. */
export function introLeadMessages(
  lead: IntroLeadFields,
  mark: IntroLeadMark = 'saved',
): IntroLeadMessages {
  const label = contactLabelOr(lead.channel, 'Контакт');
  const [tgMark, mailMark] = mark === 'saved' ? [null, null] : MARKS[mark];
  const tg = [
    '📩 <b>Новая заявка с сайта</b>',
    tgMark,
    '',
    `👤 <b>Имя:</b> ${escapeHtml(lead.name)}`,
    `📬 <b>${label}:</b> ${escapeHtml(lead.contact)}`,
    lead.message ? `💬 <b>Запрос:</b>\n${escapeHtml(lead.message)}` : null,
    lead.source ? `🔗 <b>Откуда:</b> ${escapeHtml(lead.source)}` : null,
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
