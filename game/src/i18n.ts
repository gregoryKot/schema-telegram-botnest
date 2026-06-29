// Простой i18n: язык определяется один раз (Telegram → браузер → ru), хранится в
// localStorage. Переключатель в меню вызывает setLang + reload — все тексты
// пересобираются на новом языке. t(ru, en) вызывается в момент создания строки.

import { EN } from './translations';

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

/** Вернуть строку текущего языка. t('русский', 'english'). */
export function t(ru: string, en: string): string {
  return lang === 'en' ? en : ru;
}

/** Перевести игровую строку по словарю. Нет в словаре / lang ru → как есть. */
export function tr(ru: string): string {
  if (lang !== 'en') return ru;
  return EN[ru] ?? ru;
}
