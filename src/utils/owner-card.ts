import { CANONICAL_HOST } from '../infra/canonical-host';

// Сообщения владельцу (ADMIN_ID) в Telegram несут только событие, id, время,
// статус и сумму: данные человека в мессенджер не уходят (152-ФЗ). Имя,
// контакт и текст человека — в письме на почте или в панели после входа.

/** Панель владельца; вкладка «Запись» открывается по умолчанию. */
export const ADMIN_PANEL_URL = `https://${CANONICAL_HOST}/admin`;

/** Строка карточки: где лежат данные человека. */
export const DATA_IN_EMAIL = '📧 Данные человека — в письме на почте.';

/** Сообщение в два канала: Telegram — карточка без данных человека, письмо — полное. */
export interface OwnerNotice {
  telegram: string;
  email: string;
}

/** Сигнал владельцу с темой письма. */
export interface OwnerAlert {
  html: OwnerNotice;
  subject: string;
}

/** Строка без данных человека уходит в оба канала как есть. */
export function noticeChannels(text: string | OwnerNotice): OwnerNotice {
  return typeof text === 'string' ? { telegram: text, email: text } : text;
}

const STAMP = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** «13.11.2026, 15:04 МСК» — время события в карточке. */
export function mskStamp(at: Date): string {
  return `${STAMP.format(at)} МСК`;
}

/** Тип ошибки без текста: в `message` Prisma и драйверов попадают значения полей. */
export function errorKind(e: unknown): string {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  const name = e instanceof Error ? e.name : typeof e;
  return typeof code === 'string' ? `${name} ${code}` : name;
}
