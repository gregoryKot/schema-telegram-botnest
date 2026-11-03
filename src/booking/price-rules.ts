import { BadRequestException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { parseWholePrice } from './whole-price';

/**
 * Границы цены сессии, рубли. Потолок — защита от мусорного ввода ('1e+22'
 * раньше превращалось в 1 ₽ через parseInt), а не решение о цене. Нижняя
 * граница зависит от типа: бесплатность определяется типом (INTRO_15), а не
 * ценой, так что платная сессия за 0 — не «акция», а сломанная настройка
 * (аудит 2026-10-11): HELD-бронь со счётом Robokassa на 0,00 ₽.
 */
export const PRICE_MAX = 1_000_000;

export function minPrice(type: SessionType): number {
  return type === SessionType.INTRO_15 ? 0 : 1;
}

/** Значение из BookingSetting → цена; null, если его нет или оно не целое в границах. */
export function parsePrice(
  type: SessionType,
  raw: string | undefined,
): number | null {
  return parseWholePrice(raw, minPrice(type), PRICE_MAX);
}

/** Цена из админки перед записью: округление и границы, иначе 400. Знакомство
 * бесплатно по типу — его цену не пишем вовсе (форма «Цены» её и не показывает). */
export function validPrice(type: SessionType, amount: number): number {
  if (type === SessionType.INTRO_15)
    throw new BadRequestException('INTRO_IS_FREE');
  const n = Math.round(amount);
  if (!Number.isFinite(n) || n < minPrice(type) || n > PRICE_MAX) {
    throw new BadRequestException('INVALID_PRICE');
  }
  return n;
}

/** Последняя линия перед Robokassa: счёт на 0, минус или NaN не выставляем. */
export function payableAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }
  return amount;
}
