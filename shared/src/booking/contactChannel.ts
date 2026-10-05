// Канал связи клиента в заявке на визитке. Владелец живёт за границей и не
// звонит на российские номера — посетитель выбирает, где ему ответить.
// Бэкенд держит копию списка в src/booking/contact-channel.ts (rootDir
// бэкенда не пускает в shared/); сверка — contact-channel.sync.spec.ts.

export const CONTACT_CHANNELS = [
  'telegram',
  'whatsapp',
  'max',
  'email',
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export function isContactChannel(v: unknown): v is ContactChannel {
  return (
    typeof v === 'string' && (CONTACT_CHANNELS as readonly string[]).includes(v)
  );
}

const LABELS: Record<ContactChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  max: 'MAX',
  email: 'Почта',
};

const PLACEHOLDERS: Record<ContactChannel, string> = {
  telegram: '@username или номер телефона',
  whatsapp: 'Номер с кодом страны',
  max: 'Номер телефона',
  email: 'Адрес почты',
};

export function contactChannelLabel(ch: ContactChannel): string {
  return LABELS[ch];
}

export function contactPlaceholder(ch: ContactChannel): string {
  return PLACEHOLDERS[ch];
}

/** Для Telegram по номеру человека можно не найти (приватность) — подсказка, когда введён номер, а не @username. */
export function telegramNumberHint(
  ch: ContactChannel,
  value: string,
): string | null {
  if (ch !== 'telegram' || value.includes('@')) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7
    ? 'Если профиль закрыт от поиска по номеру, укажите @username'
    : null;
}
