// Денежный алерт: error() о платеже, который требует ручной проверки (аудит
// 2026-11, хвост R9). AlertGate схлопывает цифры в ключе троттлинга, и второй
// «платёж без строки в БД» с другим InvId в те же 60 с гасился бы и оставался
// только в логе, а это деньги другого человека. Поэтому денежный текст
// помечается явно, и гейт ведёт его отдельно: ключ — весь текст с InvId,
// бюджет — свой (общий потолок прочих алертов его не глушит).

/** Метка в начале текста. Видна и в DM, и в логе. */
export const MONEY_MARK = '💰 ';

/**
 * Текст error() о деньгах. Уходит в DM целиком (alert-text.ts), поэтому в нём
 * только InvId, сумма и статус; ошибка — вторым аргументом (money-alert.spec.ts).
 */
export function moneyAlert(text: string): string {
  return MONEY_MARK + text;
}

export function isMoneyAlert(message: string): boolean {
  return message.startsWith(MONEY_MARK);
}
