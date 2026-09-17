// Точка входа: приложение спрашивает `getHost()` и работает с любым хостом
// одинаково. Определение делаем один раз за жизнь вкладки — хост не меняется.
import { createTelegramHost, isTelegramContext } from './telegram';
import { createMaxHost, hasMaxLaunchParams, maxWebApp } from './max';
import { createWebHost } from './web';
import type { HostBridge, HostId } from './types';

export * from './types';
export { createTelegramHost } from './telegram';
export { createMaxHost } from './max';
export { createWebHost } from './web';

export function detectHostId(): HostId {
  // Порядок — от неподделываемого признака к слабому.
  // 1. Стартовые параметры MAX в адресе: видны до загрузки моста и без него
  //    (их скрипт с чужого CDN может не доехать, а подпись уже в адресе).
  if (hasMaxLaunchParams()) return 'max';
  // 2. Живая телеграмная подпись весит больше, чем сам факт window.WebApp:
  //    объект создаётся слишком легко. Инцидент 2026-08-08 — загрузчик моста
  //    сработал на телеграмном `#tgWebAppData=…`, и ВСЕ пользователи Telegram
  //    увидели «Не удалось войти» про MAX. Корень чинит max-bridge.js, порядок
  //    держит второй слой.
  if (isTelegramContext()) return 'telegram';
  // 3. Мост без параметров в адресе — телеграмный SDK его создать не может.
  if (maxWebApp()) return 'max';
  return 'web';
}

let current: HostBridge | null = null;

export function getHost(): HostBridge {
  // Адаптер держим один на вкладку, но проверку хоста делаем каждый раз: это
  // чтение свойства, зато мост не залипает в «браузере», если объект хоста
  // появился позже нашего первого вызова (так ведут себя и тесты, и клиенты,
  // которые инициализируют мост после загрузки скрипта).
  const id = detectHostId();
  if (!current || current.id !== id) current = createHost(id);
  return current;
}

export function createHost(id: HostId): HostBridge {
  switch (id) {
    case 'telegram':
      return createTelegramHost();
    case 'max':
      return createMaxHost();
    default:
      return createWebHost();
  }
}

/** Только для тестов: подменить хост или заставить определить заново. */
export function setHost(host: HostBridge | null): void {
  current = host;
}
