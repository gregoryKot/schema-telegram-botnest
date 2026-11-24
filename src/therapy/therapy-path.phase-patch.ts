import { BadRequestException } from '@nestjs/common';
import { encryptRecord } from '../utils/crypto-record';
import type { PathPhasePatch } from './therapy-path.types';
import { PATH_PHASE_SCHEMA } from './therapy-path.view';

// Дни — `YYYY-MM-DD`, строки сравниваются как даты; конец раньше начала — 400.
export function assertDatesInOrder(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): void {
  if (startedAt && endedAt && endedAt < startedAt)
    throw new BadRequestException('Phase end is before its start');
}

/** PATCH: итоговые даты фазы (присланная поверх сохранённой) идут по порядку. */
export function assertPatchDates(
  phase: { startedAt: string | null; endedAt: string | null },
  patch: PathPhasePatch,
): void {
  assertDatesInOrder(
    patch.startedAt !== undefined ? patch.startedAt : phase.startedAt,
    patch.endedAt !== undefined ? patch.endedAt : phase.endedAt,
  );
}

/** Присланные поля правки фазы, свободный текст зашифрован. */
export function phasePatchData(patch: PathPhasePatch) {
  return encryptRecord(
    {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.goal !== undefined && { goal: patch.goal }),
      ...(patch.weeks !== undefined && { weeks: patch.weeks }),
      ...(patch.note !== undefined && { note: patch.note }),
      ...(patch.criteriaDone !== undefined && {
        criteriaDone: patch.criteriaDone,
      }),
      ...(patch.startedAt !== undefined && { startedAt: patch.startedAt }),
      ...(patch.endedAt !== undefined && { endedAt: patch.endedAt }),
    },
    PATH_PHASE_SCHEMA,
  );
}
