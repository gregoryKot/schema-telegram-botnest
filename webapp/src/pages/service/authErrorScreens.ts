// Свой экран `/auth/error` для кода (U6, аудит 2026-11): просроченная ссылка
// из письма показывала «Вход не удался» с техническим кодом, а кнопка вела на
// общий вход — форму почты там надо было искать заново. Здесь — заголовок и
// главная кнопка; текст — из словаря `authErrorReasons.ts`, кода на экране
// нет (в отчёт он уходит как раньше).

/** Вход с уже открытой формой почты (`LoginEmailForm` читает `via=email`). */
export const EMAIL_FORM_PATH = '/login?via=email';

export interface AuthErrorScreen {
  title: string;
  action: { label: string; href: string };
  /** Текст, когда рядом «Повторить» (ссылка из письма цела, токен ещё в памяти). */
  retryLead?: (tr: (ty: string, vy: string) => string) => string;
}

const NEW_LINK = { label: 'Запросить новую ссылку', href: EMAIL_FORM_PATH };
const OTHER_WAY = { label: 'Другой способ входа', href: '/login' };
const AUTH_ERROR_SCREENS: Record<string, AuthErrorScreen> = {
  google_disabled: { title: 'Вход через Google отключён', action: OTHER_WAY },
  vk_disabled: { title: 'Вход через ВКонтакте отключён', action: OTHER_WAY },
  email_link_expired: { title: 'Ссылка устарела', action: NEW_LINK },
  email_network: { title: 'Нет связи', action: NEW_LINK, retryLead: (tr) => tr(
    'Ссылка из письма ещё действует: проверь интернет и нажми «Повторить».',
    'Ссылка из письма ещё действует: проверьте интернет и нажмите «Повторить».',
  ) },
};

/** Экран для известного кода; прочие коды — общий «Вход не удался». */
export function authErrorScreen(code: string | null): AuthErrorScreen | null {
  return code && Object.prototype.hasOwnProperty.call(AUTH_ERROR_SCREENS, code)
    ? AUTH_ERROR_SCREENS[code]
    : null;
}
