// Что показать в виде «карточка клиента» кабинета (/cabinet/<код>,
// TherapistClientSheet). До 2026-10 веток было две — карточка или ничего:
// ссылка на удалённого, чужого или несуществующего клиента давала пустой
// экран (на телефоне — одна нижняя навигация), а выбранный клиент, не
// сброшенный после удаления, оживал по «Назад» в браузере (QA 2026-10-26).
import type { TherapyClientSummary } from '../../api';
import { matchesClientRef } from '../../../../shared/src/utils/clientRef';

export type ClientCardState = 'card' | 'loading' | 'missing' | 'failed';

interface Input {
  loading: boolean;
  loadFailed: boolean;
  clients: TherapyClientSummary[];
  selected: TherapyClientSummary | null;
  /** Код карточки или старый числовой id из адреса; null/undefined — вид переключают без адреса (тесты). */
  openClientRef?: string | null;
}

export function clientCardState({ loading, loadFailed, clients, selected, openClientRef }: Input): ClientCardState {
  if (openClientRef == null) return selected ? 'card' : loading ? 'loading' : 'missing';
  // Карточка — только того клиента, чей код (id) в адресе: иначе под чужим адресом
  // висел бы прежний (в том числе уже удалённый) клиент.
  if (selected && matchesClientRef(selected, openClientRef)) return 'card';
  // Список ещё грузится, или клиент в нём есть и эффект адреса вот-вот его откроет.
  if (loading || clients.some(c => matchesClientRef(c, openClientRef))) return 'loading';
  // Сбой ≠ «нет такого клиента»: не знаем, есть ли он.
  return loadFailed ? 'failed' : 'missing';
}
