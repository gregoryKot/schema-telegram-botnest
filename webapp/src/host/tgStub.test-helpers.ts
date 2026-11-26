// Только для тестов: подставной объект SDK Telegram. Хост определяется по
// настоящему globalThis.Telegram.WebApp (getHost() подмену через setHost
// затирает, если детектор говорит другое), поэтому тесты стоят на шве.
import { setHost } from '../../../shared/src/host';

type Stub = Record<string, unknown>;

export function installTelegram(extra: Stub = {}): Stub {
  const webApp: Stub = {
    platform: 'ios',
    initData: 'query_id=1',
    onEvent: () => {},
    offEvent: () => {},
    ...extra,
  };
  (globalThis as { Telegram?: unknown }).Telegram = { WebApp: webApp };
  setHost(null);
  return webApp;
}

export function removeTelegram(): void {
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
}
