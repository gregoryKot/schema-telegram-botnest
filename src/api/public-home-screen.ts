// Анонимным поверхностям (правило №5/№14): лендинг (AppInstallSection.tsx) и
// страница установки /install (InstallPage.tsx). 'later'/'never' — состояния
// воронки, аноним не обязан быть честным. На странице установки 'shown' —
// факт открытия (воронка: открыли → нажали → поставили), 'handoff_ok' /
// 'handoff_failed' — забрал ли браузер сессию из мессенджера. Остальные
// поверхности авторизованы — POST /api/event. Расширять — сознательное решение.
export const PUBLIC_HOME_SCREEN_SURFACES: ReadonlySet<string> = new Set([
  'site_landing',
  'site_install',
]);
export const PUBLIC_HOME_SCREEN_ACTIONS: ReadonlySet<string> = new Set([
  'shown',
  'add',
  'added',
  'handoff_ok',
  'handoff_failed',
]);
