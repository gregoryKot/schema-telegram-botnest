// Перешифровка всех зашифрованных колонок ТЕКУЩИМ ENCRYPTION_KEY.
//
// Тело ротации живёт здесь, а не в точке входа (src/cli/rotate-encryption-key.ts):
// клиент Prisma приходит параметром, поэтому ту же функцию гоняет живой спек
// test/key-rotation.e2e-spec.ts на настоящем Postgres (правило №18).
//
// Устойчивость: ошибка одной модели НЕ обрывает остальные — иначе одна кривая
// запись списка оставляла бы половину базы под старым ключом (так скрипт умирал
// на седьмой модели из 27). Всё, что не удалось, собирается в `failed`.
import type { PrismaClient } from '@prisma/client';
import { rotateConceptHistory } from './rotate-history';
import { StepResult, rotateValue } from './rotate-value';
import { Delegate, delegateOf, pkColumns } from './delegates';
import { RotationTarget, TARGETS } from './targets';

export { pkColumns };

type Row = Record<string, unknown>;
export type RotationLog = (line: string) => void;
export interface RotationReport {
  rows: number;
  failed: string[];
}
export interface RotationOptions {
  log?: RotationLog;
  targets?: RotationTarget[];
}

// Условие обновления несёт СТАРОЕ значение каждой перешифровываемой колонки.
// Ротация идёт на живом приложении (шаг 2 ранбука: контейнер уже перезапущен
// с новым ключом). Запись, которую приложение изменило между чтением и
// обновлением, уже лежит под новым ключом — безусловный update затёр бы её
// свежую правку старым содержимым. Пропущенная строка не ошибка.
async function rotateTarget(
  repo: Delegate,
  t: RotationTarget,
  log: RotationLog,
): Promise<StepResult> {
  const pks = pkColumns(t);
  const select: Record<string, true> = {};
  for (const c of [...pks, ...t.fields]) select[c] = true;
  const rows = await repo.findMany({ select });
  let touched = 0;
  let skipped = 0;
  let unreadable = 0;
  for (const row of rows) {
    const data: Row = {};
    const where: Row = {};
    for (const c of pks) where[c] = row[c];
    for (const f of t.fields) {
      const v = row[f];
      // Шифротекст — строка. null и легаси-JSON (массив/объект) не трогаем.
      if (typeof v !== 'string') continue;
      const r = rotateValue(v);
      if (r.unreadable) unreadable++;
      if (r.next === null) continue;
      data[f] = r.next;
      where[f] = { equals: v };
    }
    if (Object.keys(data).length === 0) continue;
    const { count } = await repo.updateMany({ where, data });
    if (count > 0) touched++;
    else skipped++;
  }
  const note = skipped > 0 ? `, изменились во время ротации: ${skipped}` : '';
  log(
    touched > 0
      ? `✓ ${t.name}: перешифровано ${touched} из ${rows.length}${note}`
      : `  ${t.name}: менять нечего (строк: ${rows.length}${note})`,
  );
  return { touched, unreadable };
}

export async function rotateAll(
  prisma: PrismaClient,
  opts: RotationOptions = {},
): Promise<RotationReport> {
  const log = opts.log ?? (() => undefined);
  const steps: Array<{ label: string; run: () => Promise<StepResult> }> = [
    ...(opts.targets ?? TARGETS).map((t) => ({
      label: t.name,
      run: () => rotateTarget(delegateOf(prisma, t.name), t, log),
    })),
    {
      label: 'clientConceptualization.history',
      run: () => rotateConceptHistory(prisma, log),
    },
  ];
  const report: RotationReport = { rows: 0, failed: [] };
  for (const step of steps) {
    try {
      const r = await step.run();
      report.rows += r.touched;
      if (r.unreadable > 0) {
        report.failed.push(
          `${step.label} (не расшифровалось: ${r.unreadable})`,
        );
        log(
          `✗ ${step.label}: ${r.unreadable} знач. не расшифровались ни одним ключом ` +
            '(возможна опечатка в ENCRYPTION_KEY_OLD)',
        );
      }
    } catch (e) {
      report.failed.push(step.label);
      log(`✗ ${step.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}

// Итог для оператора. Пока `failed` не пуст, ENCRYPTION_KEY_OLD убирать нельзя.
export function summarize(r: RotationReport): string {
  if (r.failed.length === 0)
    return `Готово: перешифровано строк — ${r.rows}. ENCRYPTION_KEY_OLD можно убирать.`;
  return (
    `НЕ ротировано: [${r.failed.join(', ')}]. Перешифровано строк — ${r.rows}.\n` +
    'ENCRYPTION_KEY_OLD НЕ убирать: эти колонки ещё под старым ключом. ' +
    'Причину (строки ✗ выше) устранить и запустить ротацию повторно.'
  );
}
