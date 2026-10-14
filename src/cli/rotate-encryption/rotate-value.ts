import { looksLikeCiphertext, reencrypt } from '../../utils/crypto';

export interface RotatedValue {
  /** Шифротекст под текущим ключом; null — менять нечего. */
  next: string | null;
  /**
   * Значение выглядит как наш шифротекст, но ни один из известных ключей не
   * подошёл: опечатка в ENCRYPTION_KEY_OLD либо порча. Тихо пропустить такое
   * нельзя — после удаления ENCRYPTION_KEY_OLD оно осталось бы мусором, а
   * ротация сообщила бы об успехе.
   */
  unreadable: boolean;
}

export function rotateValue(v: string): RotatedValue {
  const fresh = reencrypt(v);
  if (fresh !== null && fresh !== v) return { next: fresh, unreadable: false };
  return { next: null, unreadable: looksLikeCiphertext(v) };
}

// Что ротация нашла на шаге: сколько строк переписала и сколько значений не
// смогла прочитать.
export interface StepResult {
  touched: number;
  unreadable: number;
}
