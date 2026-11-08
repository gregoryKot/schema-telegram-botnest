// Код TOTP: выпуск секрета, otpauth-ссылка, проверка шести цифр. Единственное
// место, которое знает otplib (с 13-й версии API функциональный), — вынесено
// из totp.service.ts (правило №10), чтобы переезды библиотеки не расползались.
import type { Logger } from '@nestjs/common';
import {
  createGuardrails,
  generateSecret,
  generateURI,
  verifySync,
} from 'otplib';

const ISSUER = 'Schema Happens';

// Общие опции каждой генерации и проверки кода.
// MIN_SECRET_BYTES: 10 — секреты, выданные до переезда на otplib 13, длиной
// 10 байт (16 символов base32). otplib 13 по умолчанию требует от 16 байт и
// бросал бы на каждом коде такого секрета — все, кто уже включил 2FA,
// потеряли бы вход. Новые секреты otplib 13 выпускает по 20 байт.
// epochTolerance: 30 — допуск ±1 шаг по 30 с: часы телефона расходятся с
// сервером (то же окно, что `window: 1` в otplib 12).
export const TOTP_OPTIONS = {
  guardrails: createGuardrails({ MIN_SECRET_BYTES: 10 }),
  epochTolerance: 30,
} as const;

// otplib 13 бросает на токене не из шести цифр — до него доходят и буквы, и
// резервный код (DTO пропускает 6–10 символов), и он проверяется следом.
// Формат отсекаем сами: это «код не подошёл», а не ошибка.
const TOTP_FORMAT = /^\d{6}$/;

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(accountLabel: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountLabel, secret });
}

// Номер шага (RFC 6238) принятого кода или null. Номер абсолютный — тот же,
// что раньше считали из Date.now() и смещения: totpLastStep в БД совместим.
// Бросок otplib на коде правильного формата — битый секрет в БД: человеку это
// «код неверный» (401, счётчик неудач как обычно), а не 500, но в лог — error.
export function matchTotpStep(
  secret: string,
  code: string,
  logger: Logger,
): number | null {
  if (!TOTP_FORMAT.test(code)) return null;
  try {
    const res = verifySync({ secret, token: code, ...TOTP_OPTIONS });
    return res.valid && 'timeStep' in res ? res.timeStep : null;
  } catch (e) {
    // Первым аргументом — только класс: он уходит в DM владельцу (D1), текст
    // otplib может цитировать кусок секрета — его только в stdout.
    const err = e as Error;
    logger.error(`TOTP secret rejected by otplib (${err.name})`, err.message);
    return null;
  }
}
