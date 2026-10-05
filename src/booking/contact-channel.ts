// Копия shared/src/booking/contactChannel.ts, а НЕ импорт: rootDir бэкенда —
// ./src (см. client-timezone.ts). Сверка — contact-channel.sync.spec.ts.
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

export function contactChannelLabel(ch: ContactChannel): string {
  return LABELS[ch];
}

/** Подпись канала либо `fallback`, если канала нет или он неизвестный. */
export function contactLabelOr(ch: unknown, fallback: string): string {
  return isContactChannel(ch) ? contactChannelLabel(ch) : fallback;
}

/** «WhatsApp: » перед контактом; без канала или с неизвестным — пустая строка. */
export function contactPrefix(ch: unknown): string {
  return isContactChannel(ch) ? `${LABELS[ch]}: ` : '';
}
