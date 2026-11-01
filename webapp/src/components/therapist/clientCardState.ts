// Что показать в виде «карточка клиента» кабинета (/cabinet/<id>,
// TherapistClientSheet). До 2026-10 веток было две — карточка или ничего:
// ссылка на удалённого, чужого или несуществующего клиента давала пустой
// экран (на телефоне — одна нижняя навигация), а выбранный клиент, не
// сброшенный после удаления, оживал по «Назад» в браузере (QA 2026-10-26).
import type { TherapyClientSummary, UserId } from '../../api';
import { sameId } from '../../../../shared/src/utils/sameId';

export type ClientCardState = 'card' | 'loading' | 'missing' | 'failed';

interface Input {
  loading: boolean;
  loadFailed: boolean;
  clients: TherapyClientSummary[];
  selected: TherapyClientSummary | null;
  /** id из адреса; null/undefined — вид переключают без адреса (тесты). */
  openClientId?: UserId | null;
}

export function clientCardState({ loading, loadFailed, clients, selected, openClientId }: Input): ClientCardState {
  if (openClientId == null) return selected ? 'card' : loading ? 'loading' : 'missing';
  // Карточка — только того клиента, чей id в адресе: иначе под чужим адресом
  // висел бы прежний (в том числе уже удалённый) клиент.
  if (selected && sameId(selected.telegramId, openClientId)) return 'card';
  // Список ещё грузится, или клиент в нём есть и эффект адреса вот-вот его откроет.
  if (loading || clients.some(c => sameId(c.telegramId, openClientId))) return 'loading';
  // Сбой ≠ «нет такого клиента»: не знаем, есть ли он.
  return loadFailed ? 'failed' : 'missing';
}
