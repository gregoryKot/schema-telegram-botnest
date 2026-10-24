// Один REPORT занятости по CalDAV с классификацией сбоя. Отдельный модуль
// (не в caldav-busy.ts): разбор ответа там чистый и мокается в спеках
// сервиса целиком, а сетевой вызов должен идти через тот же мок.
import { CalDavFailureKind } from './caldav-health';
import { Interval, parseBusy } from './caldav-busy';

export type BusyRead =
  | { ok: true; intervals: Interval[] }
  | { ok: false; kind: CalDavFailureKind; detail: string };

// 401/403 — учётные данные, таймаут, сеть, прочий HTTP. Сам не логирует и
// не алертит — решение о тревоге принимает caldav-health.ts по смене состояния.
export async function readBusy(
  url: string,
  auth: string,
  body: string,
): Promise<BusyRead> {
  try {
    const res = await fetch(url, {
      method: 'REPORT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
      body,
      // Было 7с — не хватало на большой календарь (инцидент 2026-09-13).
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 207 && !res.ok) {
      const kind = res.status === 401 || res.status === 403 ? 'auth' : 'http';
      return { ok: false, kind, detail: `REPORT ${res.status} for ${url}` };
    }
    return { ok: true, intervals: parseBusy(await res.text()) };
  } catch (e) {
    const msg = (e as Error).message;
    const kind = /timeout|abort/i.test(msg) ? 'timeout' : 'network';
    return { ok: false, kind, detail: `${msg} for ${url}` };
  }
}
