// Удаление аккаунта — тексты и уборка после него, одни на сайт и мини-апп
// (правило №3). QA 2026-11:
// - К2: «Профиль → Удалить аккаунт» на сайте был второй реализацией и не
//   чистил хранилище. После удаления экран входа говорил «Вход устарел —
//   данные на месте» (отметка auth_seen пережила удаление), а в браузере
//   оставались настройки и контакт терапевта удалённого человека.
// - З2: «Удалить все данные» удаляло аккаунт целиком — со способами входа и
//   связью с терапевтом, — а текст говорил только о записях.
//
// Строки с обращением — внутри tr() (гейты check-second-person/address-form).
import { useEffect, useState } from 'react';
import type { Tr } from './accountLinkText';
import { clearLocalData } from '../auth/clearLocalData';
import { readLocal, removeLocal, writeLocal } from '../utils/safeLocalStorage';

export function deleteAccountCopy(tr: Tr) {
  return {
    row: 'Удалить аккаунт',
    rowSub: 'Вместе со всеми записями, способами входа и связью с терапевтом',
    title: 'Удалить аккаунт?',
    body:
      'Удалится аккаунт целиком: дневники, оценки, практики, тесты, заметки, ' +
      'задания, способы входа и связь с терапевтом — терапевт перестанет видеть ' +
      'записи. Восстановить нельзя.',
    failed: tr(
      'Не удалось удалить аккаунт. Данные на месте — проверь соединение и попробуй ещё раз.',
      'Не удалось удалить аккаунт. Данные на месте — проверьте соединение и попробуйте ещё раз.',
    ),
  };
}

/** Экран входа сразу после удаления: аккаунта больше нет, а не «вход устарел». */
export const ACCOUNT_DELETED_TEXT =
  'Аккаунт удалён: записи, способы входа и связь с терапевтом стёрты с сервера. Новый вход создаст пустой аккаунт.';

const DELETED_FLAG = 'account_deleted';

/**
 * Аккаунт удалён на сервере: стереть всё локальное — та же уборка, что при
 * выходе (clearLocalData: настройки, кеш контакта терапевта, отметка «уже
 * входил»; тема и согласие на cookie остаются), — и оставить экрану входа
 * отметку. Перезагрузку страницы делает вызывающий. Отказ хранилища
 * (приватный режим) — забота одного примитива, safeLocalStorage.
 */
export function wipeAfterAccountDeletion(): void {
  clearLocalData();
  writeLocal(DELETED_FLAG, '1');
}

/** Экран входа после удаления аккаунта? Чтение без побочных эффектов. */
export function isAccountJustDeleted(): boolean {
  return readLocal(DELETED_FLAG) === '1';
}

/** Отметка показана — снять, чтобы она не всплыла на следующем входе. */
export function clearAccountDeletedMark(): void {
  removeLocal(DELETED_FLAG);
}

/** Экран входа: показать «Аккаунт удалён» один раз — отметка снимается. */
export function useAccountDeletedNotice(): boolean {
  const [deleted] = useState(isAccountJustDeleted);
  useEffect(() => {
    if (deleted) clearAccountDeletedMark();
  }, [deleted]);
  return deleted;
}
