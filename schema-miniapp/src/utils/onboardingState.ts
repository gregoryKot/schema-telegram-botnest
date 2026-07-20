// Единая точка правды «онбординг пройден / согласие дано».
//
// Инцидент (iOS, ярлык на домашнем экране): согласие сохранялось ТОЛЬКО в
// финальной кнопке онбординга. Шаг «Добавить на экран» стоял последним и уводил
// пользователя из аппки (Telegram открывает нативный шит) — до финальной кнопки
// он не доходил, ничего не сохранялось, и при заходе с ярлыка онбординг
// показывался заново.
//
// Отсюда два инварианта, которые фиксируют тесты:
//  1. согласие персистится в момент, когда обе галочки поставлены и
//     пользователь ушёл с шага согласий, — а не в конце онбординга;
//  2. источник правды — серверный флаг onboardingV2Done; localStorage лишь
//     быстрый кэш (Telegram WebView его чистит, а у ярлыка с домашнего экрана
//     на iOS вообще отдельное хранилище), поэтому до загрузки серверных флагов
//     онбординг не показываем.

export const DISCLAIMER_KEY = 'disclaimer_v2_accepted';
export const ONBOARDING_SEEN_KEY = 'app_onboarding_seen_v1';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    // localStorage недоступен (приватный режим) — считаем, что не проходили;
    // серверный флаг всё равно закроет показ.
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // не страшно: серверный флаг — источник правды
  }
}

export function isOnboardingSeenLocally(): boolean {
  return readFlag(ONBOARDING_SEEN_KEY);
}

export function isDisclaimerAcceptedLocally(): boolean {
  return readFlag(DISCLAIMER_KEY);
}

export function markOnboardingSeenLocally(): void {
  writeFlag(ONBOARDING_SEEN_KEY);
}

export function markDisclaimerAcceptedLocally(): void {
  writeFlag(DISCLAIMER_KEY);
}

/**
 * Показывать ли онбординг. Отдельная чистая функция, потому что раньше это
 * условие жило инлайном в JSX и «моргало»: пока серверные флаги не загрузились,
 * пустой localStorage читался как «не проходил» — и пользователь, прошедший
 * онбординг, видел его снова.
 */
export function shouldShowOnboarding(state: {
  seenLocally: boolean;
  serverDone: boolean;
  flagsLoaded: boolean;
  addressFormReady: boolean;
}): boolean {
  if (state.seenLocally || state.serverDone) return false;
  // Форма обращения выбирается раньше: без неё приветствие прозвучит «на ты»
  // до того, как пользователь выбрал форму.
  if (!state.addressFormReady) return false;
  // Флаги ещё летят с сервера — ждём, иначе покажем онбординг уже прошедшему.
  return state.flagsLoaded;
}
