// Реестр env-переменных (щит, по итогам инцидентов 2026-09-15/16: пустой
// ADMIN_EMAIL молчал, GOOGLE_REDIRECT_URI указывал на редиректящийся хост).
// До этого файла не было ОДНОГО места, где перечислено «какие переменные
// есть, обязательны ли на проде, какого формата» — 48+ переменных читались
// напрямую по всему src/**. Дополняет, не дублирует:
//   - src/infra/capability-report.ts — про «фича ВЫКЛЮЧЕНА, если переменной
//     нет» (молчаливая деградация);
//   - src/auth/oauth-redirect-config.ts — точечная сверка адреса возврата
//     OAuth с каноническим хостом.
// Этот реестр — про «переменная ПРИСУТСТВУЕТ, но её формат/состав неверны»
// (опечатка, чужой хост, пустая строка) — оба класса тихие по построению:
// приложение стартует и работает как ни в чём не бывало.
//
// Только типы и валидаторы форматов — сами записи в env-registry.entries.ts
// (правило №10: файл-реестр держим отдельно от дата-файла).

export type EnvValue = string | undefined;
/** null — формат в порядке; строка — что именно не так (человеческим языком). */
export type FormatValidator = (value: string) => string | null;

export type EnvGroup =
  'auth' | 'telegram' | 'email' | 'channel' | 'booking' | 'infra';

export interface EnvVarSpec {
  name: string;
  /** Одна человеческая фраза — для чего переменная, что сломается без неё. */
  purpose: string;
  requiredInProd: boolean;
  format: FormatValidator;
  group: EnvGroup;
}

const isHttpUrl = (value: string, requireHttps: boolean): string | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'не похоже на URL (не парсится)';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `схема «${url.protocol}» — ожидался http(s)`;
  }
  if (requireHttps && url.protocol !== 'https:') {
    return 'ожидался https, а не http';
  }
  return null;
};

/** Готовые форматы — переиспользуй, не пиши валидатор заново под каждую переменную. */
export const formats = {
  /** Валидный http(s) URL. */
  url: (value: string): string | null => isHttpUrl(value, false),
  /** Валидный URL, обязательно https (адреса возврата OAuth, публичный вебапп). */
  httpsUrl: (value: string): string | null => isHttpUrl(value, true),
  integer: (value: string): string | null =>
    /^-?\d+$/.test(value) ? null : 'не целое число',
  /** Telegram user id — положительное целое (умещается в Number, см. main.ts). */
  telegramId: (value: string): string | null =>
    /^\d+$/.test(value)
      ? null
      : 'не похоже на Telegram id (ожидались только цифры)',
  /** ENCRYPTION_KEY(_OLD) — 32 байта в hex (64 символа), см. src/utils/crypto.ts. */
  hex32: (value: string): string | null =>
    /^[0-9a-f]{64}$/i.test(value)
      ? null
      : `ожидалось 64 hex-символа (32 байта), получено ${value.length}`,
  email: (value: string): string | null =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'не похоже на email',
  nonEmpty: (value: string): string | null =>
    value.trim().length > 0 ? null : 'пустая строка',
  /** Токен Telegram-бота: `<numeric id>:<secret>`, см. BotFather. */
  botToken: (value: string): string | null =>
    /^\d+:[\w-]{30,}$/.test(value)
      ? null
      : 'не похоже на токен бота (ожидался вид `123456789:AAAA...`)',
  /** Значение обязано быть одним из перечисленных (сравнение как есть). */
  oneOf:
    (allowed: string[]): FormatValidator =>
    (value: string): string | null =>
      allowed.includes(value)
        ? null
        : `ожидалось одно из [${allowed.join(', ')}], получено «${value}»`,
  /** Формат не проверяем (свободный текст/PEM/URL с нестандартной схемой). */
  any: (): string | null => null,
} as const;
