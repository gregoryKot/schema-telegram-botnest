import { useState, useEffect } from 'react';

// Минимальная форма Telegram.WebApp, которую реально читаем (инсеты, признак
// полноэкранного режима и подписка на события). Точечный тип вместо `any`.
type TgSafeArea = {
  contentSafeAreaInset?: { top?: number };
  safeAreaInset?: { top?: number };
  isFullscreen?: boolean;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
};

// Высота полосы плавающих кнопок Telegram (закрыть/меню) в полноэкранном
// режиме — нижняя граница отступа на случай, если клиент ещё/вообще не прислал
// contentSafeAreaInset. Без неё кнопки шапки оказываются ПОД перекрытием
// Telegram и не нажимаются (баг «кнопки некликабельны сверху» в fullscreen).
const FULLSCREEN_CONTROLS_TOP = 48;
// Фолбэк для старых НЕ-полноэкранных клиентов на iOS, где кнопка закрытия
// накладывается поверх контента, а инсеты ещё не пришли.
const IOS_LEGACY_TOP = 56;

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Чистое вычисление верхнего отступа безопасной зоны. Вынесено из хука, чтобы
 * покрыть тестом все ветки (полный экран, iOS-фолбэк, честный ноль).
 *
 * Инвариант: в полноэкранном режиме результат ВСЕГДА очищает полосу плавающих
 * кнопок Telegram (>= deviceTop + FULLSCREEN_CONTROLS_TOP), даже если клиент
 * ещё не сообщил contentSafeAreaInset.
 */
export function computeSafeTop(p: {
  contentTop?: number;
  deviceTop?: number;
  isFullscreen: boolean;
  ios: boolean;
}): number {
  const device = p.deviceTop ?? 0;
  const content = p.contentTop ?? 0;
  const real = device + content;

  // Полный экран: сверху висят плавающие кнопки Telegram. Обычно их высоту
  // отдаёт contentSafeAreaInset.top, но он приходит с задержкой (или не
  // приходит на части клиентов) — держим нижнюю границу, иначе шапка под ними.
  if (p.isFullscreen) {
    return Math.max(real, device + FULLSCREEN_CONTROLS_TOP);
  }

  if (real > 0) return real;
  // Инсеты нулевые. Если контентный инсет явно определён (== 0) — доверяем ему.
  if (p.contentTop !== undefined) return 0;
  return p.ios ? IOS_LEGACY_TOP : 0;
}

function read(tg: TgSafeArea | undefined): number {
  if (!tg) return 0;
  return computeSafeTop({
    contentTop: tg.contentSafeAreaInset?.top,
    deviceTop: tg.safeAreaInset?.top,
    isFullscreen: !!tg.isFullscreen,
    ios: isIOS(),
  });
}

/**
 * Reactive hook — updates when Telegram reports safe area / fullscreen changes.
 * In fullscreen it always clears Telegram's floating control band so header
 * buttons stay tappable (see FULLSCREEN_CONTROLS_TOP).
 */
export function useSafeTop(): number {
  const [safeTop, setSafeTop] = useState<number>(() =>
    read(window.Telegram?.WebApp),
  );

  useEffect(() => {
    const tg = window.Telegram?.WebApp as TgSafeArea | undefined;
    if (!tg) return;

    const update = () => setSafeTop(read(tg));

    tg.onEvent?.('safeAreaChanged', update);
    tg.onEvent?.('contentSafeAreaChanged', update);
    tg.onEvent?.('fullscreenChanged', update);
    // Telegram нередко присылает инсеты/признак fullscreen с задержкой —
    // перечитываем несколько раз после монтирования.
    const t1 = setTimeout(update, 150);
    const t2 = setTimeout(update, 500);

    return () => {
      tg.offEvent?.('safeAreaChanged', update);
      tg.offEvent?.('contentSafeAreaChanged', update);
      tg.offEvent?.('fullscreenChanged', update);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return safeTop;
}

/** @deprecated Use useSafeTop() hook instead */
export function getTelegramSafeTop(): number {
  return read(window.Telegram?.WebApp);
}
