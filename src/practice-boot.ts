import { BOOT_SCREEN } from './infra/spa-root';

/** Картинки запуска iOS со знаком продукта: у визитки их нет, iOS покажет белый экран. */
const IOS_STARTUP_IMAGES =
  /[ \t]*<link rel="apple-touch-startup-image"[^>]*>\n?/g;

/** HTML без того, что показывает знак продукта при запуске: экран загрузки и картинки запуска iOS. */
export const withoutProductBoot = (html: string): string =>
  html.replace(BOOT_SCREEN, '').replace(IOS_STARTUP_IMAGES, '');
