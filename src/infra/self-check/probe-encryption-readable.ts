import type { PrismaService } from '../../prisma/prisma.service';
import { delegateOf, pkColumns } from '../../cli/rotate-encryption/delegates';
import { TARGETS, RotationTarget } from '../../cli/rotate-encryption/targets';
import {
  ColumnTally,
  NESTED_COLUMNS,
  tallyColumn,
  tallyNested,
} from './encryption-tally';
import { Probe, ProbeResult } from './types';

/** Сколько последних строк каждой таблицы читает проба (по первичному ключу). */
export const SAMPLE_ROWS = 200;
const MAX_LISTED = 6;
const MAX_DETAIL = 300;

async function tallyTarget(
  prisma: PrismaService,
  t: RotationTarget,
  take: number,
): Promise<ColumnTally[]> {
  const pks = pkColumns(t);
  const nested = NESTED_COLUMNS[t.name] ?? [];
  const select: Record<string, true> = {};
  for (const c of [...pks, ...t.fields, ...nested]) select[c] = true;
  const rows = await delegateOf(prisma, t.name).findMany({
    select,
    take,
    orderBy: pks.map((c) => ({ [c]: 'desc' as const })),
  });
  return [
    ...t.fields.map((f) => tallyColumn(`${t.name}.${f}`, f, rows)),
    ...nested.map((c) => tallyNested(`${t.name}.${c}`, c, rows)),
  ];
}

export function describeTallies(
  tallies: ColumnTally[],
  errors: string[],
  take: number,
): ProbeResult {
  const bad = tallies.filter((c) => c.unreadable > 0);
  const checked = tallies.reduce((n, c) => n + c.checked, 0);
  if (bad.length === 0 && errors.length === 0) {
    return {
      ok: true,
      detail: `все читаются: проверено значений ${checked} в ${tallies.length} колонках (последние ${take} строк каждой таблицы)`,
    };
  }
  const total = bad.reduce((n, c) => n + c.unreadable, 0);
  const listed = bad
    .slice(0, MAX_LISTED)
    .map((c) => `${c.column} ${c.unreadable} из ${c.checked}`);
  const more =
    bad.length > MAX_LISTED ? `, ещё колонок: ${bad.length - MAX_LISTED}` : '';
  const parts = [
    bad.length > 0
      ? `не читаются ни одним ключом: ${total} знач. (${listed.join(', ')}${more}); проверить ENCRYPTION_KEY и ENCRYPTION_KEY_OLD`
      : '',
    errors.length > 0
      ? `не удалось прочитать таблицы: ${errors.join(', ')}`
      : '',
  ].filter(Boolean);
  return { ok: false, detail: parts.join('; ').slice(0, MAX_DETAIL) };
}

/**
 * Масштаб провала расшифровки по паре таблица.колонка. decryptRecord при
 * чтении отдаёт `[]`/сырую строку и шлёт троттлированный DM без таблицы — одну
 * нечитаемую строку от 10 000 он отличить не даёт (аудит 2026-10, D-8).
 * Проба обходит тот же список колонок, что и ротация ключа (TARGETS, сверенный
 * с реестром шифрования; снапшоты history — encryption-tally.ts), и
 * считает значения «похоже на наш шифротекст, но ни один ключ не подошёл». Выборка — последние строки таблицы: провал ключа бьёт
 * по всем строкам сразу, а полный обход всех дневников раз в час дороже пользы.
 * Содержимого в detail нет — только имена колонок и счётчики.
 *
 * Не в /health (`reportInHealth: false`), как clinicalLabels: нечитаемое не
 * исчезает, пока ключи не починят, и красный /health держал бы prod-smoke.yml
 * красным. DM при смене состояния и блок «Самопроверка» в /stats — достаточно.
 * Известный ложный сигнал: открытый латинский текст без пробелов от 40 символов
 * в зашифрованной колонке неотличим от шифротекста (трейд-офф encrypt-migration).
 */
export function encryptionReadableProbe(
  prisma: PrismaService,
  env: NodeJS.ProcessEnv = process.env,
  targets: RotationTarget[] = TARGETS,
  take: number = SAMPLE_ROWS,
): Probe {
  return {
    id: 'encryptionReadable',
    title: 'Читаемость шифрованных данных',
    reportInHealth: false,
    async run() {
      if (!env.ENCRYPTION_KEY?.trim()) return { ok: true, detail: 'выключено' };
      const errors: string[] = [];
      const settled = await Promise.all(
        targets.map((t) =>
          tallyTarget(prisma, t, take).catch((e: unknown) => {
            errors.push(
              `${t.name} (${(e as Error)?.message ?? 'ошибка'})`.slice(0, 80),
            );
            return [] as ColumnTally[];
          }),
        ),
      );
      return describeTallies(settled.flat(), errors, take);
    },
  };
}
