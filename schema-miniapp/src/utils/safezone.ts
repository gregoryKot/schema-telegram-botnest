import { useState, useEffect, useRef } from 'react';

// Минимальная форма Telegram.WebApp, которую реально читаем (инсеты, признак
// полноэкранного режима и подписка на события). Точечный тип вместо `any`.
type TgSafeArea = {
  contentSafeAreaInset?: { top?: number };
  safeAreaInset?: { top?: number };
  isFullscreen?: boolean;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
};

// Высота полосы плавающих кнопок Telegram (закрыть/меню) НИЖЕ статус-бара в
// полноэкранном режиме, когда клиент не прислал contentSafeAreaInset. На iOS
// эта полоса высокая (~72px) — маленького запаса мало, текст/кнопки шапки
// уезжают под перекрытие Telegram; на Android она ниже.
const FS_BAND_IOS = 76;
const FS_BAND_ANDROID = 48;
// Абсолютный минимум для iOS в fullscreen, когда НЕ пришёл и device-инсет:
// статус-бар (~47) + полоса кнопок. Без него на notch/Dynamic Island отступа 0.
const IOS_FULLSCREEN_MIN = 100;
// Фолбэк для старых НЕ-полноэкранных клиентов на iOS, где кнопка закрытия
// накладывается поверх контента, а инсеты ещё не пришли.
const IOS_LEGACY_TOP = 56;

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Чистое вычисление верхнего отступа безопасной зоны. Вынесено из хука, чтобы
 * покрыть тестом все ветки (полный экран — с инсетами и без, iOS-фолбэк, ноль).
 *
 * Ключ к полноэкранному режиму: точное официальное значение (device + content)
 * берём ТОЛЬКО когда клиент реально прислал оба инсета (`contentReported` +
 * device > 0). Иначе инсеты не доехали (частый баг клиентов) — держим щедрую
 * границу, гарантированно очищающую плавающие кнопки Telegram: перекрытие
 * текста/кнопок хуже лишних пикселей отступа.
 */
export function computeSafeTop(p: {
  contentTop?: number;
  deviceTop?: number;
  isFullscreen: boolean;
  ios: boolean;
  contentReported: boolean;
}): number {
  const device = p.deviceTop ?? 0;
  const content = p.contentTop ?? 0;
  const real = device + content;

  if (p.isFullscreen) {
    // Оба инсета пришли → доверяем точному значению (без лишнего отступа на
    // корректных клиентах, включая iPhone SE с маленьким статус-баром).
    if (p.contentReported && device > 0) return real;
    // Инсеты не доехали → щедрая граница под полосу кнопок Telegram.
    if (p.ios) return Math.max(real, device + FS_BAND_IOS, IOS_FULLSCREEN_MIN);
    return Math.max(real, device + FS_BAND_ANDROID);
  }

  if (real > 0) return real;
  // Инсеты нулевые. Если контентный инсет явно определён (== 0) — доверяем ему.
  if (p.contentTop !== undefined) return 0;
  return p.ios ? IOS_LEGACY_TOP : 0;
}

function read(tg: TgSafeArea | undefined, contentReported: boolean): number {
  if (!tg) return 0;
  return computeSafeTop({
    contentTop: tg.contentSafeAreaInset?.top,
    deviceTop: tg.safeAreaInset?.top,
    isFullscreen: !!tg.isFullscreen,
    ios: isIOS(),
    contentReported,
  });
}

/**
 * Reactive hook — updates when Telegram reports safe area / fullscreen changes.
 * In fullscreen it uses the exact inset once the client reports it, and a
 * generous fallback until/unless it does, so header text and buttons never end
 * up under Telegram's floating controls.
 */
export function useSafeTop(): number {
  // Прислал ли клиент contentSafeAreaInset хоть раз. Значение может быть 0 —
  // сам факт события важнее числа, поэтому отдельный флаг, а не проверка > 0.
  const contentReportedRef = useRef(false);
  const [safeTop, setSafeTop] = useState<number>(() =>
    read(window.Telegram?.WebApp, false),
  );

  useEffect(() => {
    const tg = window.Telegram?.WebApp as TgSafeArea | undefined;
    if (!tg) return;

    const update = () => setSafeTop(read(tg, contentReportedRef.current));
    const onContent = () => {
      contentReportedRef.current = true;
      update();
    };

    tg.onEvent?.('safeAreaChanged', update);
    tg.onEvent?.('contentSafeAreaChanged', onContent);
    tg.onEvent?.('fullscreenChanged', update);
    // Telegram нередко присылает инсеты/признак fullscreen с задержкой —
    // перечитываем несколько раз после монтирования.
    const t1 = setTimeout(update, 150);
    const t2 = setTimeout(update, 500);

    return () => {
      tg.offEvent?.('safeAreaChanged', update);
      tg.offEvent?.('contentSafeAreaChanged', onContent);
      tg.offEvent?.('fullscreenChanged', update);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return safeTop;
}

/** @deprecated Use useSafeTop() hook instead */
export function getTelegramSafeTop(): number {
  return read(window.Telegram?.WebApp, true);
}
