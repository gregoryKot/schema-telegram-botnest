// Кросс-проверки env входа через внешние сервисы (VK ID, Яндекс ID):
// подключаются в CROSS_CHECKS (env-check.ts). Задан идентификатор приложения —
// обязаны быть заданы и остальные переменные провайдера: без любой из них
// рубильник (src/auth/oauth-provider-switch.ts) держит вход выключенным, а
// владелец думает, что настроил его. Состав обязан совпадать с
// OAUTH_PROVIDER_ENV — сверку держит oauth-provider-switch.spec.ts (правило №4).
import type { CrossCheck } from './env-check';
import { requiresToo } from './env-check.requires';

export const OAUTH_CROSS_CHECKS: CrossCheck[] = [
  requiresToo('vkAppRequiresRedirect', 'VK_APP_ID', 'VK_REDIRECT_URI'),
  requiresToo(
    'yandexIdRequiresSecretAndRedirect',
    'YANDEX_CLIENT_ID',
    'YANDEX_CLIENT_SECRET',
    'YANDEX_REDIRECT_URI',
  ),
];
