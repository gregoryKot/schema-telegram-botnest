import { decrypt, encrypt } from '../utils/crypto';

// Имена клиентов, введённые терапевтом (алиас, офлайн-клиент, имя в
// приглашении), — PII, шифруются; легаси plaintext читается как есть
// (decrypt tolerant). Одно место для связей и для списка приглашений.
export const decName = (v: string | null): string | null =>
  v == null ? null : (decrypt(v) ?? v);

/** Пустое имя после trim — null (имени нет), иначе шифротекст. */
export const encName = (v: string | null | undefined): string | null => {
  const name = v?.trim();
  return name ? (encrypt(name) ?? name) : null;
};
