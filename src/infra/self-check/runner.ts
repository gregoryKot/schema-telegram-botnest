import { Probe, ProbeResult } from './types';
import { SelfCheckResultEntry } from './state';

/** Проба, не уложившаяся в это время, засчитывается упавшей — иначе одна
 * зависшая проверка (например, до недоступного iCloud) держит весь прогон
 * и следующий тик крона наступает на ту же дыру. */
export const PROBE_TIMEOUT_MS = 10_000;

async function withTimeout(
  probe: Probe,
  timeoutMs: number,
): Promise<ProbeResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          ok: false,
          detail: `не ответила за ${Math.round(timeoutMs / 1000)} с`,
        }),
      timeoutMs,
    );
    timer.unref?.();
  });
  try {
    return await Promise.race([probe.run(), timeout]);
  } catch (e) {
    return {
      ok: false,
      detail: (e as Error)?.message?.slice(0, 200) ?? 'упала с ошибкой',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Прогоняет все пробы параллельно, с таймаутом и агрегацией на каждую —
 * одна упавшая/зависшая проба не мешает увидеть остальные. */
export async function runProbes(
  probes: Probe[],
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<SelfCheckResultEntry[]> {
  return Promise.all(
    probes.map(async (p) => {
      const r = await withTimeout(p, timeoutMs);
      return {
        id: p.id,
        title: p.title,
        critical: p.critical,
        ok: r.ok,
        detail: r.detail,
        reportInHealth: p.reportInHealth !== false,
      };
    }),
  );
}
