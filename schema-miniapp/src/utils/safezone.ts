import { useState, useEffect } from 'react';
import { getHost } from '../../../shared/src/host';

// Высота полосы плавающих кнопок Telegram (закрыть/меню) НИЖЕ статус-бара в
// полноэкранном режиме, когда клиент не прислал contentSafeAreaInset. На iOS
// эта полоса высокая (~72px) — маленького запаса мало, текст/кнопки шапки
// уезжают под перекрытие Telegram; на Android она ниже.
const FS_BAND_IOS = 76;
const FS_BAND_ANDROID = 48;
// Абсолютный минимум для iOS в fullscreen, когда НЕ пришёл и device-инсет:
// статус-бар (~47) + полоса кнопок. Без него на notch/Dynamic Island отступа 0.
const IOS_FULLSCREEN_MIN = 100;
// Фолбэк для старых НЕ-полноэкранных клиентов на iOS, где кнопки Telegram
// накладываются поверх контента, а инсеты ещё не пришли.
//
// Было 56 — этого хватало, чтобы уйти из-под статус-бара, но НЕ из-под пилюли
// «Закрыть»: на iPhone с Dynamic Island её нижний край около 87pt, и заголовок
// экрана всё равно оказывался под кнопками (скриншот пользователя, 2026-08).
// Берём с запасом: ветка работает только когда клиент не сообщил НИЧЕГО, а там
// лишние пиксели дешевле перекрытого заголовка.
const IOS_LEGACY_TOP = 96;

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
  /** хост рисует свои кнопки поверх контента (мессенджер, не браузер) */
  overlaysContent?: boolean;
}): number {
  const device = p.deviceTop ?? 0;
  const content = p.contentTop ?? 0;
  const real = device + content;

  if (p.isFullscreen) {
    // Точному значению доверяем, только когда пришли ОБА инсета ненулевыми
    // (без лишнего отступа на корректных клиентах, включая iPhone SE с
    // маленьким статус-баром). Нулевая полоса контента в полноэкранном режиме
    // — это «не доехало»: свои кнопки клиент рисует всегда.
    if (p.contentReported && device > 0 && content > 0) return real;
    // Инсеты не доехали → щедрая граница под полосу кнопок Telegram.
    if (p.ios) return Math.max(real, device + FS_BAND_IOS, IOS_FULLSCREEN_MIN);
    return Math.max(real, device + FS_BAND_ANDROID);
  }

  if (real > 0) return real;
  // Инсеты нулевые. Внутри мессенджера на iOS это значит «не доехало», а не
  // «отступ не нужен»: клиент всё равно рисует кнопку закрытия поверх верха
  // экрана. Раньше нулю верили — и шапка уезжала под статус-бар и кнопки
  // (скриншот пользователя, 2026-08; тот же класс, что FS_BAND_IOS выше).
  if (p.ios && p.overlaysContent) return IOS_LEGACY_TOP;
  // Браузер: чёлку закрывает CSS env(safe-area-inset-*), лишний отступ вреден.
  if (p.contentTop !== undefined) return 0;
  return p.ios ? IOS_LEGACY_TOP : 0;
}

function read(): number {
  const insets = getHost().insets();
  return computeSafeTop({
    contentTop: insets.contentTop,
    deviceTop: insets.deviceTop,
    isFullscreen: insets.isFullscreen,
    ios: isIOS(),
    contentReported: insets.contentReported,
    overlaysContent: insets.overlaysContent,
  });
}

/**
 * Отступ сверху, пересчитанный по сигналам хоста. В полноэкранном режиме
 * используется точный инсет, как только хост его прислал, и щедрый фолбэк,
 * пока не прислал: текст и кнопки шапки не должны уезжать под плавающие
 * кнопки мессенджера. Подписки и повторное чтение запоздавших значений —
 * забота адаптера хоста, тут только пересчёт.
 */
export function useSafeTop(): number {
  const [safeTop, setSafeTop] = useState<number>(read);

  useEffect(() => getHost().onInsetsChange(() => setSafeTop(read())), []);

  return safeTop;
}
