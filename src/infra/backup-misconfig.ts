// Итог пробы свежести бэкапов, когда они не настроены или настроены не до
// конца (probe-backup-freshness.ts). Выключены вовсе — штатно: копии делает
// платформа (Amvera), Yandex Object Storage — по желанию.
import { backupConfigState, missingBackupVars } from './backup-config';

type Env = Record<string, string | undefined>;

/** null — настроены полностью, можно идти в Yandex Object Storage. */
export function backupMisconfigResult(
  env: Env,
): { ok: boolean; detail: string } | null {
  const state = backupConfigState(env);
  if (state === 'on') return null;
  if (state === 'partial') {
    const missing = missingBackupVars(env).join(', ');
    return {
      ok: false,
      detail: `бэкапы настроены не до конца: не заданы ${missing}`,
    };
  }
  return { ok: true, detail: 'выключено' };
}
