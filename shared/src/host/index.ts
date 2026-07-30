// Точка входа: приложение спрашивает `getHost()` и работает с любым хостом
// одинаково. Определение делаем один раз за жизнь вкладки — хост не меняется.
import { createTelegramHost, telegramWebApp } from './telegram';
import { createWebHost } from './web';
import type { HostBridge, HostId } from './types';

export * from './types';
export { createTelegramHost } from './telegram';
export { createWebHost } from './web';

export function detectHostId(): HostId {
  if (telegramWebApp()) return 'telegram';
  // Сюда же придёт MAX, когда появится его адаптер: у мессенджера свой
  // глобальный объект от MAX Bridge.
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
    default:
      return createWebHost();
  }
}

/** Только для тестов: подменить хост или заставить определить заново. */
export function setHost(host: HostBridge | null): void {
  current = host;
}
