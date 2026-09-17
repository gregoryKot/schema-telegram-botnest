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
// Когда перечитывать хост и инсеты после монтирования. Не зависит от адаптера
// намеренно: страховка не должна жить внутри той ветки, которая может не
// запуститься.
const LATE_HOST_READS_MS = [150, 500, 1500, 3000];

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

  // Вне полноэкранного режима кнопки мессенджера НЕ обязаны висеть поверх:
  // современный Telegram в sheet-режиме рисует сплошную шапку НАД webview —
  // полоса контента честно нулевая, и страховка 96px давала дыру над
  // заголовком (четвёртый заход, скриншот 2026-08-12). Правило: способному
  // клиенту (прислал полосу контента — объект contentSafeAreaInset есть,
  // Bot API 8.0+) верим ТОЧНО, включая ноль. Страховка под пилюлю «Закрыть»
  // остаётся только старым клиентам, которые полосу прислать не умеют —
  // у них перекрытие не отличить от сплошной шапки, а перекрытый заголовок
  // хуже лишних пикселей (скриншоты 2026-08, три раза подряд). Про iOS
  // условия нет намеренно: на Android то же самое.
  if (p.overlaysContent) {
    if (p.contentReported && p.contentTop !== undefined) return real;
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

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | null = null;
    let attachedTo: string | null = null;
    const apply = () => {
      if (alive) setSafeTop(read());
    };

    // Хост может смениться уже ПОСЛЕ монтирования: telegram-web-app.js
    // грузится асинхронно, и до его прихода WebApp пустой — приложение честно
    // считает себя открытым в браузере. Подписка браузерного адаптера —
    // заглушка, поэтому первая же такая гонка навсегда замораживала отступ
    // нулём, и шапка оказывалась под кнопками мессенджера (три скриншота
    // подряд, 2026-08). Механизм повторного чтения жил ВНУТРИ телеграмного
    // адаптера, то есть ровно в той ветке, которая не запускалась.
    const attach = () => {
      const host = getHost();
      if (host.id !== attachedTo) {
        attachedTo = host.id;
        unsub?.();
        unsub = host.onInsetsChange(apply);
      }
      apply();
    };

    attach();
    const timers = LATE_HOST_READS_MS.map((ms) => setTimeout(attach, ms));
    // Возврат в приложение и поворот экрана тоже меняют инсеты.
    document.addEventListener('visibilitychange', apply);
    window.addEventListener('resize', apply);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', apply);
      window.removeEventListener('resize', apply);
      unsub?.();
    };
  }, []);

  return safeTop;
}
