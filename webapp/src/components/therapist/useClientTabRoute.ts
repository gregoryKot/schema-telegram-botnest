// Синхронизация вкладок кабинета с адресом (вкладки — therapist/clientTabRoute).
// Вынесено из TherapistClientSheet (правило №10).
//
// Смена вкладки карточки пишет адрес через replace с прежним state: запись
// истории на каждую вкладку увела бы «← Все клиенты» (navigate(-1) при
// state.fromList, appShell/navigation) на прошлую вкладку вместо списка.
// Вкладки списка («Клиенты» / «Задания») — обычный переход: это смена раздела.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { clientRef, matchesClientRef } from '../../../../shared/src/utils/clientRef';
import type { ClientTab } from './clientSheetTypes';
import { keepLayoutSearch } from './plan/keepLayoutSearch';
import { clientCardPath, clientTabFromPath, LEGACY_TASKS_PATH } from './clientTabRoute';

interface Params {
  view: 'list' | 'client';
  openClientRef?: string | null;
  detail: { selectedClient: TherapyClientSummary | null; clientTab: ClientTab; setClientTab: (t: ClientTab) => void };
}

export function useClientTabRoute({ view, openClientRef, detail }: Params) {
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const routeTab = clientTabFromPath(pathname);
  const { selectedClient, clientTab } = detail;
  // Открыта карточка именно того клиента, что в адресе (не прежний, не без адреса в тестах).
  const onCard = view === 'client' && selectedClient != null && matchesClientRef(selectedClient, openClientRef);

  // Адрес сменил вкладку у открытой карточки (ссылка в сайдбаре, «Назад»).
  useEffect(() => {
    if (onCard) detail.setClientTab(routeTab ?? 'overview');
  }, [routeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Вкладку сменили в карточке (или карточку открыли) — адрес за ней, без новой записи.
  useEffect(() => {
    if (!onCard) return;
    const to = clientCardPath(clientRef(selectedClient), clientTab);
    if (to !== pathname) navigate({ pathname: to, search: keepLayoutSearch(search) }, { replace: true, state });
    // onCard — в зависимостях: карточку открывают и сразу на вкладке (палитра → «Задания»), а
    // адрес /cabinet/<код> приходит следующим рендером — без него вкладка из адреса терялась.
  }, [clientTab, selectedClient, onCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Доски «Задания» больше нет: её адрес из старых закладок и уведомлений ведёт на список клиентов.
  useEffect(() => {
    if (pathname === LEGACY_TASKS_PATH) navigate('/cabinet', { replace: true });
  }, [pathname, navigate]);
  return { routeTab };
}
