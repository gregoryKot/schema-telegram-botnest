// Идентификаторы баннеров-переходов (meta.banner для событий web_banner_open
// / web_banner_dismiss). 'cabinet_full' и 'mode_map' — баннеры «полная
// версия на сайте» в мини-аппе (schema-miniapp/src/utils/webBanner.ts);
// 'mobile_app' — баннер «Открыть приложение» на мобильной версии сайта
// (webapp/src/components/MobileAppBanner.tsx). При добавлении баннера
// синхронь список с соответствующим фронтом. Вынесено из
// analytics.constants.ts отдельным файлом (правило №10, тот же приём, что у
// signup-sources.constants.ts).
export const WEB_BANNER_IDS = [
  'cabinet_full',
  'mode_map',
  'mobile_app',
] as const;
export type WebBannerId = (typeof WEB_BANNER_IDS)[number];
