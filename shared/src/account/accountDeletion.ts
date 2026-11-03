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

// Переживают удаление осознанно: тема оформления и согласие на cookie — про
// устройство, а не про человека.
const KEEP = ['app_theme', 'cookie_consent'];
const DELETED_FLAG = 'account_deleted';

/**
 * Аккаунт удалён на сервере: стереть всё локальное (настройки, кеш контакта
 * терапевта, отметку «уже входил») и оставить экрану входа отметку на одну
 * вкладку. Перезагрузку страницы делает вызывающий.
 */
export function wipeAfterAccountDeletion(): void {
  try {
    const kept = KEEP.map((k) => [k, localStorage.getItem(k)] as const);
    localStorage.clear();
    for (const [k, v] of kept) if (v !== null) localStorage.setItem(k, v);
  } catch {
    // Хранилище недоступно (приватный режим) — стирать в нём и нечего.
  }
  try {
    sessionStorage.clear();
    sessionStorage.setItem(DELETED_FLAG, '1');
  } catch {
    // Без отметки экран входа покажет обычный текст — аккаунт всё равно удалён.
  }
}

/** Экран входа после удаления аккаунта? Чтение без побочных эффектов. */
export function isAccountJustDeleted(): boolean {
  try {
    return sessionStorage.getItem(DELETED_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Отметка показана — снять, чтобы она не всплыла на следующем входе. */
export function clearAccountDeletedMark(): void {
  try {
    sessionStorage.removeItem(DELETED_FLAG);
  } catch {
    // Хранилище недоступно — и отметки там нет.
  }
}

/** Экран входа: показать «Аккаунт удалён» один раз — отметка снимается. */
export function useAccountDeletedNotice(): boolean {
  const [deleted] = useState(isAccountJustDeleted);
  useEffect(() => {
    if (deleted) clearAccountDeletedMark();
  }, [deleted]);
  return deleted;
}
