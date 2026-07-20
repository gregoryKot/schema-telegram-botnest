// Предложение «добавить мини-апп на домашний экран».
//
// Картинку с инструкцией рисует САМ Telegram — мы только зовём
// WebApp.addToHomeScreen(). На iOS этот нативный экран врёт: показывает
// инструкцию «нажми три точки» (Android-вёрстка), а открывает шит «Поделиться».
// Починить чужой нативный экран нельзя, поэтому на платформах, где он
// некорректен, шаг не предлагаем вовсе — лучше без шага, чем инструкция,
// которая не совпадает с тем, что видит пользователь.

// Значения window.Telegram.WebApp.platform: 'android' | 'android_x' | 'ios' |
// 'macos' | 'tdesktop' | 'weba' | 'webk' | 'unknown'.
const PLATFORMS_WITH_WORKING_PROMPT = ['android', 'android_x'];

export function canOfferHomeScreen(
  platform: string | undefined,
  hasApi: boolean,
): boolean {
  if (!hasApi) return false;
  if (!platform) return false;
  return PLATFORMS_WITH_WORKING_PROMPT.includes(platform);
}

export function canOfferHomeScreenNow(): boolean {
  const tg = window.Telegram?.WebApp;
  return canOfferHomeScreen(tg?.platform, !!tg?.addToHomeScreen);
}
