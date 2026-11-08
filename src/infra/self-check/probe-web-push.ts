// Уведомления в приложении (веб-пуши, src/push/) глазами самопроверки
// (правило №21: новая внешняя интеграция = проба). Две вещи: VAPID-ключи
// заданы парой и принимаются web-push (та же проверка, что перед каждой
// отправкой), и до push-сервиса Google (FCM — им пользуются Chrome и Android)
// доходит HTTPS-запрос с таймаутом. Любой HTTP-ответ — сервис доступен:
// анонимный запрос ничего не отправляет. Выключено по конфигу (ключей нет) —
// не авария.
//
// Наружу в /health не идёт (как пробы OAuth): доступность зарубежных хостов
// с Amvera мигает, и сетевой сбой красил бы смок прода. Владельцу — DM и
// /stats, как любая проба.
import { readVapid } from '../../push/push-config';
import { Probe } from './types';

export const WEB_PUSH_PROBE_URL = 'https://fcm.googleapis.com/';
const TIMEOUT_MS = 8_000;

type FetchFn = (url: string, init: RequestInit) => Promise<{ status: number }>;

export function webPushProbe(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: FetchFn = fetch,
): Probe {
  return {
    id: 'webPush',
    title: 'Уведомления в приложении',
    reportInHealth: false,
    retryOnce: true, // живой запрос к push-сервису Google (Probe.retryOnce)
    async run() {
      const vapid = readVapid(env);
      if (vapid.kind === 'off') return { ok: true, detail: 'выключено' };
      if (vapid.kind === 'broken') return { ok: false, detail: vapid.problem };
      try {
        const res = await fetchFn(WEB_PUSH_PROBE_URL, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return {
          ok: true,
          detail: `ключи в порядке, push-сервис Google отвечает (HTTP ${res.status})`,
        };
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        return {
          ok: false,
          detail: `push-сервис Google недоступен: ${msg.slice(0, 160)}`,
        };
      }
    },
  };
}
