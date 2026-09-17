import { listCalendars } from '../../booking/caldav-discovery';
import { calDavHealth, CalDavFailureKind } from '../../booking/caldav-health';
import { Probe } from './types';

/** Классификация как в caldav-busy-read.ts (401/403 — учётка, timeout/abort
 * — таймаут, остальной HTTP-статус — http, иначе сеть). Своя копия: у
 * PROPFIND (caldav-discovery.ts) и REPORT (caldav-busy-read.ts) разные
 * тексты ошибок, общий классификатор не выносили ради двух условий. */
function classify(e: unknown): { kind: CalDavFailureKind; detail: string } {
  const msg = (e as Error)?.message ?? String(e);
  const detail = msg.slice(0, 200);
  if (/\s(401|403)(\s|$)/.test(msg)) return { kind: 'auth', detail };
  if (/timeout|abort/i.test(msg)) return { kind: 'timeout', detail };
  if (/PROPFIND \d/.test(msg)) return { kind: 'http', detail };
  return { kind: 'network', detail };
}

/**
 * Живое обнаружение календарей iCloud — тот же путь, что CalDavService
 * (listCalendars). Обновляет ОБЩИЙ трекер caldav-health.ts, поэтому /stats
 * («Личный календарь») видит правду даже если между прогонами никто не
 * открывал слоты записи — регресс 2026-09-13/16 жил именно в такой тишине.
 */
export function caldavProbe(env: NodeJS.ProcessEnv = process.env): Probe {
  return {
    id: 'caldav',
    title: 'Личный календарь (iCloud)',
    critical: false,
    async run() {
      const id = env.APPLE_ID?.trim();
      const pass = env.APPLE_APP_PASSWORD?.trim();
      if (!id || !pass) return { ok: true, detail: 'выключено' };
      if (env.APPLE_CALDAV_URL?.trim()) {
        // Явный адрес — как и CalDavService, не проверяем его живьём здесь:
        // тот же best-effort, что у getBase() в caldav.service.ts.
        return {
          ok: true,
          detail:
            'используется явный APPLE_CALDAV_URL — автообнаружение пропущено',
        };
      }
      const auth = 'Basic ' + Buffer.from(`${id}:${pass}`).toString('base64');
      try {
        const cals = await listCalendars(auth);
        if (cals.length === 0) {
          calDavHealth.noteFailure(
            'empty',
            'самопроверка: обнаружение не нашло ни одного календаря',
          );
          return {
            ok: false,
            detail: 'обнаружение не нашло ни одного календаря',
          };
        }
        calDavHealth.noteSuccess();
        return { ok: true, detail: `найдено календарей: ${cals.length}` };
      } catch (e) {
        const { kind, detail } = classify(e);
        calDavHealth.noteFailure(kind, detail);
        return { ok: false, detail };
      }
    },
  };
}
