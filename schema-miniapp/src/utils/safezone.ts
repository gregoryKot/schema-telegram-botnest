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
// Нижняя граница отступа, когда хост рисует свои кнопки поверх контента, а
// внятной полосы контента от него нет. Пилюля «Закрыть» на iPhone с Dynamic
// Island заканчивается около 87pt — берём с запасом.
const OVERLAY_MIN_TOP = 96;

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

  // Мессенджер рисует «Закрыть» и меню ПОВЕРХ контента — приложение всегда
  // вызывает expand(), и в развёрнутом режиме кнопки висят над страницей, хотя
  // isFullscreen при этом false. Описывает эти кнопки только
  // contentSafeAreaInset; вне полноэкранного режима клиенты сплошь и рядом
  // присылают там ноль. Раньше в этом случае мы верили device-инсету — а он
  // закрывает лишь чёлку, и шапка всё равно уезжала под пилюлю «Закрыть»
  // (скриншоты пользователя, 2026-08, три раза подряд).
  //
  // Поэтому: точному значению верим, только когда клиент прислал НЕНУЛЕВУЮ
  // полосу контента. Иначе держим границу, гарантированно очищающую кнопки —
  // лишние пиксели дешевле перекрытого заголовка. Условие про iOS убрано
  // намеренно: на Android кнопки висят так же.
  if (p.overlaysContent) {
    if (p.contentReported && content > 0) return real;
    return Math.max(real, OVERLAY_MIN_TOP);
  }

  if (real > 0) return real;
  // Хост не объявил, перекрывает ли он контент, и инсетов не прислал вовсе —
  // на iOS держим ту же страховку: адаптер без флага не должен молча вернуть
  // приложение к перекрытой шапке.
  if (p.contentTop === undefined && p.ios) return OVERLAY_MIN_TOP;
  // Браузер: чёлку закрывает CSS env(safe-area-inset-*), лишний отступ вреден.
  return 0;
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
