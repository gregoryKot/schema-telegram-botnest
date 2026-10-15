// BigInt в JSON-ответах. Веб-аккаунты (Google/VK/MAX/почта) получают
// User.id в [1e15, 9e15) — ниже MAX_SAFE_INTEGER (≈9.007e15), пин в
// user-id-range.spec.ts. Расширишь за 2^53 — `Number(id)` округлит номер, и
// клиент придёт с чужим «соседним» id (аудит 2026-10, X-1).
//
// Правило: безопасное целое — числом (id Telegram ~1e9–1e10 и все счётчики,
// фронты и тесты к этому привыкли), всё что не влезает точно — десятичной
// строкой. Фронт принимает `number | string` (shared `UserId`).

/** Значение BigInt для JSON: число, если точно представимо, иначе строка. */
export function bigintToJson(value: bigint): number | string {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return value <= max && value >= -max ? Number(value) : value.toString();
}

/** Ставит глобальный `BigInt.prototype.toJSON` (вызывается из main.ts). */
export function installBigIntJson(): void {
  (BigInt.prototype as unknown as { toJSON: () => number | string }).toJSON =
    function (this: bigint) {
      return bigintToJson(this);
    };
}
