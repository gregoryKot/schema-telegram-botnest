// Единый i18n. Язык определяется один раз (Telegram → браузер → ru), хранится в
// localStorage. Переключатель в меню вызывает setLang + reload. Все строки живут
// в messages.ts (ключ → { ru, en }); t(key) отдаёт строку текущего языка.
//
// Один механизм: t('m_ключ'). Ключи типизированы (опечатка → ошибка компиляции),
// а messages.ts через `satisfies` гарантирует, что у каждого ключа есть оба языка
// (пропущенный перевод → ошибка компиляции, а не молчаливый русский).

import { M, type MsgKey } from './messages';

const KEY = 'rtym_lang';
export type Lang = 'ru' | 'en';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch { /* приватный режим */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code as string | undefined;
  const code = (tg || navigator.language || 'ru').toLowerCase();
  return code.startsWith('en') ? 'en' : 'ru';
}

export let lang: Lang = detect();

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* ok */ }
}

/**
 * Локализованная строка по ключу. Подстановка {placeholder} из vars.
 *   t('m_hud_understood', { u: 3, tot: 5 })
 */
export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  let s = M[key][lang];
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

export type { MsgKey };
