// Общий вход терапевтских ручек концептуализации (дописать с холста, колесо
// потребностей — concept-append.controller.ts): роль и ключ пары
// «терапевт — клиент», плюс перевод отказа проверки связи в 403.
import { ForbiddenException } from '@nestjs/common';
import { uid, type AuthRequest } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import type { AccountService } from '../bot/account.service';

export interface ConceptKey {
  therapistId: bigint;
  clientId: bigint;
}

/**
 * Роль ≠ THERAPIST — 403 до чтения связи и базы; кривой id клиента — 400
 * (parseClientId). Связь с клиентом проверяет сама операция (assertHasClient).
 */
export async function therapistConceptKey(
  account: Pick<AccountService, 'getUserRole'>,
  req: AuthRequest,
  clientId: string,
): Promise<ConceptKey> {
  const therapistId = uid(req);
  const role = await account.getUserRole(therapistId);
  if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
  return { therapistId, clientId: parseClientId(clientId) };
}

/** Чужой клиент ('No active relation' из assertHasClient) — 403, а не 500. */
export function relationForbidden(e: unknown): never {
  if (e instanceof Error && e.message === 'No active relation')
    throw new ForbiddenException('No active relation with this client');
  throw e;
}
