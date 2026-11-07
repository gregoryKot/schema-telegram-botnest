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
import type { TasksBoard } from './useTasksBoard';
import { clientCardPath, clientTabFromPath, listTabFromPath, listTabPath, type ListTab } from './clientTabRoute';

interface Params {
  view: 'list' | 'client';
  openClientRef?: string | null;
  detail: { selectedClient: TherapyClientSummary | null; clientTab: ClientTab; setClientTab: (t: ClientTab) => void };
  board: Pick<TasksBoard, 'open'>;
}

export function useClientTabRoute({ view, openClientRef, detail, board }: Params) {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const routeTab = clientTabFromPath(pathname);
  const listTab = listTabFromPath(pathname);
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
    if (to !== pathname) navigate(to, { replace: true, state });
    // onCard — в зависимостях: с доски карточку открывают сразу на «Заданиях», а
    // адрес /cabinet/<код> приходит следующим рендером — без него вкладка из адреса терялась.
  }, [clientTab, selectedClient, onCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Прямой вход на /cabinet/tasks: доска грузится так же, как по кнопке.
  useEffect(() => {
    if (listTab === 'kanban') board.open();
  }, [listTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const setListTab = (t: ListTab) => {
    if (t !== listTab) navigate(listTabPath(t));
  };
  return { routeTab, listTab, setListTab };
}
