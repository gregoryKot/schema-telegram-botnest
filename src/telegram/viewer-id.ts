// «Кому показали карточку сверки» — сырой telegramId, приведённый к bigint.
/**
 * Сырой telegramId как «кому показали карточку». НЕ userId: для сверки
 * карточки нужен именно номер, под которым человек пишет боту, а не
 * канонический (трипвайр в telegram.invariants.spec.ts ловит прямое
 * приведение сырого номера к userId — здесь это осознанно другое).
 */
export function viewerTelegramId(telegramId: number | undefined) {
  return telegramId === undefined ? undefined : BigInt(telegramId);
}
