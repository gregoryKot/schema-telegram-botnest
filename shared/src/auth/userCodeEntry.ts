// Код билета, введённый человеком руками (экран сверки `/auth/confirm`, S9
// аудита 2026-11). Код из ссылки больше не подставляется готовым: ссылку с
// чужим кодом мог прислать кто угодно (выписка билета анонимна), а совпадение
// с экраном ожидающего приложения показывает, что приложение — в руках того,
// кто подтверждает вход.
import { formatUserCode } from './loginTicketCode';

export const USER_CODE_LENGTH = 8;

// Русская раскладка: кириллические двойники латинских букв алфавита кода
// (`src/auth/login-ticket/ticket-user-code.ts`) читаем как латиницу — иначе
// «К7М2…», набранное на русской клавиатуре, не совпало бы никогда.
const CYRILLIC_TWINS: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

/** Верхний регистр, только буквы и цифры, не длиннее кода. */
export function normalizeUserCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[А-ЯЁ]/g, (ch) => CYRILLIC_TWINS[ch] ?? ch)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, USER_CODE_LENGTH);
}

/** Как показать введённое: дефис после четвёртого знака, как в приложении. */
export function displayUserCodeInput(normalized: string): string {
  return normalized.length > 4 ? formatUserCode(normalized) : normalized;
}

/** Введено ли целиком и совпадает ли с кодом билета (регистр и дефис не важны). */
export function userCodesMatch(typed: string, expected: string): boolean {
  const a = normalizeUserCode(typed);
  return a.length === USER_CODE_LENGTH && a === normalizeUserCode(expected);
}
