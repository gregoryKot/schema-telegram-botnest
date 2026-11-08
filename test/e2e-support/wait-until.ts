// Опрос до условия — для следов, которые появляются ПОСЛЕ ответа ручки.
// Первый потребитель: эффекты подтверждения брони (встреча, календарь, DM
// владельцу) идут после ответа POST /api/booking/book
// (src/booking/booking.checkout.ts, confirmNow): время ответа не выдаёт,
// клиент ли контакт. Спек, который смотрит их следы в базе или в DM, ждёт
// их здесь, а не читает базу сразу после ответа.

/** Ждёт, пока `check()` не станет истинным (опрос раз в 25 мс); иначе бросает с `what`. */
export async function waitUntil(
  check: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline)
      throw new Error(`waitUntil: не дождались за ${timeoutMs} мс — ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
