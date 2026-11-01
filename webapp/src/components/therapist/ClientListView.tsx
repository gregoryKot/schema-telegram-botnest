import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type { TherapyClientSummary, UserTask, UserId } from '../../api';
import { sameId } from '../../../../shared/src/utils/sameId';
// Местный день: с ним сравнивается nextSession — настенное время терапевта.
// Активность клиента — по его календарю (isActiveToday), не по этому дню.
import { todayStr } from '../../utils/format';
import { Skeleton } from '../Skeleton';
import { KanbanView } from './KanbanView';
import { AddClientForm } from './AddClientForm';
import { PendingInvitesList } from '../../../../shared/src/therapy/PendingInvitesList';
import { ClientCard } from './ClientCard';
import { filterRoster, sortRoster, type RosterStatus } from './rosterModel';
import type { useAddClient } from './useAddClient';
import '../../styles/therapist-clients.css';
type AllTasks = { clientId: UserId; clientName: string; tasks: UserTask[] }[] | null;

const FILTERS: { key: RosterStatus; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активны' },
  { key: 'wait', label: 'Ждут' },
  { key: 'virtual', label: 'Оффлайн' },
];

interface Props {
  animKey: number;
  clients: TherapyClientSummary[];
  loading: boolean;
  loadFailed: boolean;
  listTab: 'clients' | 'kanban';
  setListTab: React.Dispatch<React.SetStateAction<'clients' | 'kanban'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: RosterStatus;
  setFilterStatus: React.Dispatch<React.SetStateAction<RosterStatus>>;
  allTasks: AllTasks;
  allTasksLoading: boolean;
  allTasksFailed: boolean;
  setAllTasks: React.Dispatch<React.SetStateAction<AllTasks>>;
  setAllTasksLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAllTasksFailed: React.Dispatch<React.SetStateAction<boolean>>;
  openClient: (client: TherapyClientSummary) => void;
  addClient: ReturnType<typeof useAddClient>;
}

export function ClientListView({
  animKey, clients, loading, loadFailed, listTab, setListTab, searchQuery, setSearchQuery,
  filterStatus, setFilterStatus, allTasks, allTasksLoading, allTasksFailed, setAllTasks, setAllTasksLoading, setAllTasksFailed,
  openClient, addClient,
}: Props) {
  const tr = useTr();
  const [addOpen, setAddOpen] = useState(false);
  // Пустой список — онбординг: форма открыта сразу. Созданного клиента не
  // прячем, пока терапевт не увидел ссылку-приглашение (created).
  const noClients = !loading && !loadFailed && clients.length === 0;
  const formVisible = addOpen || noClients || addClient.created !== null;

  // Сбой ≠ пусто: канбан не должен показать терапевту пустую доску без
  // заданий на отказе запроса. Вынесено в функцию — переиспользуется и
  // первым кликом по вкладке, и кнопкой повтора внутри KanbanView.
  const loadAllTasks = () => {
    setAllTasksFailed(false);
    setAllTasksLoading(true);
    api.getAllTherapyTasks().then(setAllTasks).catch(() => setAllTasksFailed(true)).finally(() => setAllTasksLoading(false));
  };

  const today = todayStr();
  const filtered = sortRoster(filterRoster(clients, searchQuery, filterStatus), today);

  return (
    <div className="therapist-scroll therapist-scroll--list" key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>
      <div className="ds-page">
        <div className="ds-head-row">
          <div>
            <div className="ds-eyebrow">Практика</div>
            <h1 className="ds-h1">Клиенты{clients.length > 0 && <> <span className="tc-count">{clients.length}</span></>}</h1>
          </div>
          <button className="ds-btn" aria-expanded={formVisible} onClick={() => { setAddOpen(v => !v); }}>
            + Новый клиент
          </button>
        </div>

        {formVisible && <AddClientForm addClient={addClient} onClose={() => setAddOpen(false)} />}
        <PendingInvitesList pending={addClient.pending} className="tc-pending" />

        <div className="tc-toolbar">
          <div className="tc-modes">
            <div className="ds-seg" role="tablist">
              <button role="tab" aria-selected={listTab === 'clients'} className={`ds-seg-btn ${listTab === 'clients' ? 'is-active' : ''}`}
                      onClick={() => setListTab('clients')}>Клиенты</button>
              <button role="tab" aria-selected={listTab === 'kanban'} className={`ds-seg-btn ${listTab === 'kanban' ? 'is-active' : ''}`}
                      onClick={() => {
                        setListTab('kanban');
                        if (!allTasks && !allTasksLoading) loadAllTasks();
                      }}>Задания</button>
            </div>
            {listTab === 'clients' && (
              <div className="ds-seg">
                {FILTERS.map(f => (
                  <button key={f.key} className={`ds-seg-btn ${filterStatus === f.key ? 'is-active' : ''}`}
                          onClick={() => setFilterStatus(f.key)}>{f.label}</button>
                ))}
              </div>
            )}
          </div>
          {listTab === 'clients' && (
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Найти клиента" aria-label="Найти клиента" className="tc-search" />
          )}
        </div>

        {listTab === 'kanban' && (
          <KanbanView
            allTasks={allTasks}
            loading={allTasksLoading}
            loadFailed={allTasksFailed}
            onRetry={loadAllTasks}
            onOpenClient={(clientId) => {
              const client = clients.find(c => sameId(c.telegramId, clientId));
              if (client) openClient(client);
            }}
          />
        )}

        {listTab === 'clients' && (
          loading ? (
            <div className="tc-grid" aria-hidden>
              {[0, 1, 2].map(i => <Skeleton key={i} height={260} radius={20} />)}
            </div>
          ) : loadFailed ? (
            // Сбой ≠ пусто (CLAUDE.md: никаких заглушек вместо данных) —
            // терапевт с полным ростером не должен увидеть «клиентов нет».
            <div className="tc-error">
              {tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')}
            </div>
          ) : clients.length === 0 ? (
            <div className="tc-empty">
              {tr('Введи имя клиента выше, чтобы добавить первую карточку', 'Введите имя клиента выше, чтобы добавить первую карточку')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="tc-empty">Ничего не найдено</div>
          ) : (
            <div className="tc-grid">
              {filtered.map(client => (
                <ClientCard key={client.telegramId} client={client} today={today} onOpen={openClient} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
