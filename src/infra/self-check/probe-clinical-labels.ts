import { Probe, ProbeResult } from './types';
import { clinicalLabelsStatus } from './clinical-labels-status';
import { describeClinicalProblems } from '../../utils/encrypt-migration.report';

/**
 * Сколько миграции дают на «ещё не началась» (idle после старта процесса) и на
 * «ещё идёт» (running после старта миграции). Один прогон — пять findMany и по
 * update на нужную строку: на проде секунды. 15 минут — на порядок больше
 * реального прогона, медленный старт не будит; и заметно меньше часа между
 * прогонами самопроверки (раз в час под claimRun), поэтому зависшая или не
 * вызванная миграция краснеет не позже ближайшего часового прогона. Без
 * этого предела idle/running были бы зелёными вечно: main.ts перестал бы
 * вызывать runClinicalLabelMigration, а проба всё так же рапортовала бы «идёт».
 */
export const CLINICAL_LABELS_STUCK_MS = 15 * 60_000;

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
  now: () => number = Date.now,
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
      const waitedMs = now() - s.since;
      if (waitedMs < CLINICAL_LABELS_STUCK_MS) {
        return { ok: true, detail: 'проверка при старте ещё идёт' };
      }
      const min = Math.floor(waitedMs / 60_000);
      return {
        ok: false,
        detail:
          s.state === 'idle'
            ? `дошифровка меток так и не запустилась: прошло ${min} мин после старта`
            : `дошифровка меток идёт уже ${min} мин и не закончилась, возможно завис запрос к базе`,
      };
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
    const parts = describeClinicalProblems(s);
    if (parts.length === 0)
      return { ok: true, detail: 'все метки зашифрованы' };
    return { ok: false, detail: parts.join('; ').slice(0, 300) };
  }
}
