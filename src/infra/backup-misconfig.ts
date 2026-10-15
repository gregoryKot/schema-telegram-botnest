// Итог пробы свежести бэкапов, когда они не настроены или настроены не до
// конца (probe-backup-freshness.ts). Выключены вовсе: на Amvera штатно (копии
// делает платформа), а на VPS pgdata — единственная копия базы, и молчание
// «выключено, ok» прятало бы её потерю (аудит 2026-10, infra#11).
import { backupConfigState, missingBackupVars } from './backup-config';
import { isVpsTarget } from './deploy-target';

type Env = Record<string, string | undefined>;

/** null — настроены полностью, можно идти в R2. */
export function backupMisconfigResult(
  env: Env,
): { ok: boolean; detail: string } | null {
  const state = backupConfigState(env);
  if (state === 'on') return null;
  const missing = missingBackupVars(env).join(', ');
  if (state === 'partial') {
    return {
      ok: false,
      detail: `бэкапы настроены не до конца: не заданы ${missing}`,
    };
  }
  return isVpsTarget(env)
    ? {
        ok: false,
        detail:
          'бэкапы не настроены: единственная копия базы — диск сервера ' +
          `(не заданы ${missing})`,
      }
    : { ok: true, detail: 'выключено' };
}
