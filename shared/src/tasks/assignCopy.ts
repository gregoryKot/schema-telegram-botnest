// Что форма «Новое задание» обещает терапевту — общее для обоих фронтендов.
// До 2026-10-26 лист обещал «Появится у клиента в мини-аппе – он выполняет
// самостоятельно» любому клиенту: неверно для клиента сайта, мужской род, а
// офлайн-клиенту (без аккаунта, id < 0) задание не показывалось нигде, и
// закрыть его было нельзя (QA-проход). Офлайн-клиенту задание — пометка
// терапевта: выполненным её отмечает сам терапевт в карточке клиента.
import type { UserId } from '../userId';
import { isVirtualId } from '../utils/sameId';

export const ASSIGN_LEAD_ONLINE =
  'Задание появится у клиента в приложении. Когда оно будет выполнено, статус обновится здесь.';

export const ASSIGN_LEAD_OFFLINE =
  'Клиент не пользуется приложением, поэтому задание останется пометкой в карточке: отметить его выполненным можно на вкладке «Задания».';

/** Подпись под заголовком формы; своей цели клиента она не нужна. */
export function assignLead(clientId: UserId | undefined): string | null {
  if (clientId === undefined) return null;
  return isVirtualId(clientId) ? ASSIGN_LEAD_OFFLINE : ASSIGN_LEAD_ONLINE;
}

/**
 * Типы, которые можно назначить. Офлайн-клиенту — только «Своё задание»:
 * упражнения и серии живут в приложении, которого у клиента нет, прогресс
 * серии считать не из чего.
 */
export function assignableOptions<T extends { type: string }>(
  options: T[],
  clientId: UserId | undefined,
): T[] {
  if (clientId === undefined || !isVirtualId(clientId)) return options;
  return options.filter((o) => o.type === 'custom');
}
