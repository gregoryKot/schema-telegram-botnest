// Переменные окружения на время одного сценария замера (test/perf/scenarios.ts).
// Часть горячих путей читает env в момент вызова: владельца практики — из
// ADMIN_ID (src/utils/practice-owner.ts), готовность уведомлений в приложении —
// из ключей VAPID (src/push/push-config.ts). В джобе `perf` они не заданы, и
// без них код прода пошёл бы короткой веткой — замер мерил бы не тот путь.
// Значения ставятся только на вызов и снимаются после: сценарии идут по одному
// (run-plans.ts), соседние видят окружение джобы как есть.
import { generateVAPIDKeys } from 'web-push';

type EnvPatch = Record<string, string>;

export async function withEnv<T>(
  patch: EnvPatch,
  run: () => Promise<T>,
): Promise<T> {
  const before = Object.fromEntries(
    Object.keys(patch).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, patch);
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Свежая пара ключей VAPID: с ней pushReady() — true, очередь читает подписки. */
export function vapidEnv(): EnvPatch {
  const keys = generateVAPIDKeys();
  return {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  };
}
