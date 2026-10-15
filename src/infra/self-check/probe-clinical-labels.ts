import { Probe, ProbeResult } from './types';
import { clinicalLabelsStatus } from './clinical-labels-status';

const sum = (m: Record<string, number>): number =>
  Object.values(m).reduce((a, b) => a + b, 0);

/**
 * Дошифровка клинических меток дошла до конца без остатка. Остаток бывает
 * двух видов: строки под ключом, которого больше нет в env (убрали
 * ENCRYPTION_KEY_OLD раньше времени), и строки, которые не удалось записать.
 * Миграция на каждом старте проходит все строки и знает остаток точно, поэтому
 * проба не считает plaintext в БД сама, а читает итог последнего прогона.
 *
 * Не в /health (`reportInHealth: false`): строка под неизвестным ключом не
 * значит, что сервис лежит, и сама не уйдёт, пока ключи не починят; красный
 * /health весь этот срок держал бы prod-smoke.yml красным. DM при смене
 * состояния, напоминание раз в 6 часов и блок «Самопроверка» в /stats — это
 * достаточно. Детали: только имена таблиц и счётчики, без содержимого меток.
 */
export function clinicalLabelsProbe(
  env: NodeJS.ProcessEnv = process.env,
): Probe {
  return {
    id: 'clinicalLabels',
    title: 'Шифрование клинических меток',
    critical: false,
    reportInHealth: false,
    run: () => Promise.resolve(evaluate()),
  };

  function evaluate(): ProbeResult {
    if (!env.ENCRYPTION_KEY?.trim()) return { ok: true, detail: 'выключено' };
    const s = clinicalLabelsStatus.get();
    if (s.state === 'idle' || s.state === 'running') {
      return { ok: true, detail: 'проверка при старте ещё идёт' };
    }
    if (s.state === 'failed') {
      return {
        ok: false,
        detail:
          `миграция меток упала: ${s.lastError ?? 'причина неизвестна'}`.slice(
            0,
            300,
          ),
      };
    }
    const skipped = sum(s.unknownKey);
    if (skipped === 0 && s.failures === 0) {
      return { ok: true, detail: 'все метки зашифрованы' };
    }
    const parts: string[] = [];
    if (skipped > 0) {
      const tables = Object.entries(s.unknownKey)
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ');
      parts.push(
        `${skipped} строк не читаются текущим ключом (${tables}), возможна неполная ротация ENCRYPTION_KEY`,
      );
    }
    if (s.failures > 0) parts.push(`${s.failures} строк не удалось записать`);
    return { ok: false, detail: parts.join('; ').slice(0, 300) };
  }
}
