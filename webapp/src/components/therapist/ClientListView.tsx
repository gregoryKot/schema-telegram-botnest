import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
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
import type { TasksBoard } from './useTasksBoard';
import type { ClientTab } from './clientSheetTypes';
import '../../styles/therapist-clients.css';

const FILTERS: { key: RosterStatus; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активны' },
  { key: 'wait', label: 'Не сегодня' }, // в боте, но сегодня без активности; «Ждут» путалось с «Ждут подключения»
  { key: 'virtual', label: 'Офлайн' },
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
  /** Доска «Задания» — её держит лист кабинета (useTasksBoard). */
  board: TasksBoard;
  openClient: (client: TherapyClientSummary, tab?: ClientTab) => void;
  addClient: ReturnType<typeof useAddClient>;
}

export function ClientListView({
  animKey, clients, loading, loadFailed, listTab, setListTab, searchQuery, setSearchQuery,
  filterStatus, setFilterStatus, board, openClient, addClient,
}: Props) {
  const tr = useTr();
  // Пустой список — онбординг: форма открыта сразу. Созданного клиента не
  // прячем, пока терапевт не увидел ссылку-приглашение (created).
  const noClients = !loading && !loadFailed && clients.length === 0;
  const formVisible = addClient.open || noClients || addClient.created !== null;

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
          <button className="ds-btn" aria-expanded={formVisible} onClick={() => addClient.setOpen(v => !v)}>
            + Новый клиент
          </button>
        </div>

        {formVisible && <AddClientForm addClient={addClient} />}
        <PendingInvitesList pending={addClient.pending} className="tc-pending" />

        <div className="tc-toolbar">
          <div className="tc-modes">
            <div className="ds-seg" role="tablist">
              <button role="tab" aria-selected={listTab === 'clients'} className={`ds-seg-btn ${listTab === 'clients' ? 'is-active' : ''}`}
                      onClick={() => setListTab('clients')}>Клиенты</button>
              <button role="tab" aria-selected={listTab === 'kanban'} className={`ds-seg-btn ${listTab === 'kanban' ? 'is-active' : ''}`}
                      onClick={() => { setListTab('kanban'); board.open(); }}>Задания</button>
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
                   placeholder="Найти клиента" aria-label="Найти клиента" className="ds-input ds-input--search tc-search" />
          )}
        </div>

        {listTab === 'kanban' && (
          <KanbanView
            allTasks={board.tasks}
            loading={board.loading}
            loadFailed={board.failed}
            onRetry={board.load}
            // Клик по заданию ведёт к заданиям клиента, а не на «Обзор».
            onOpenClient={(clientId) => {
              const client = clients.find(c => sameId(c.telegramId, clientId));
              if (client) openClient(client, 'tasks');
            }}
          />
        )}

        {listTab === 'clients' && (
          loading ? (
            <div className="tc-grid" aria-hidden>
              {[0, 1, 2].map(i => <Skeleton key={i} height="var(--tc-card-h)" radius={20} />)}
            </div>
          ) : loadFailed ? (
            // Сбой ≠ пусто (CLAUDE.md: никаких заглушек вместо данных) —
            // терапевт с полным ростером не должен увидеть «клиентов нет».
            <div className="tc-error">
              {tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')}
            </div>
          ) : clients.length === 0 ? (
            <p className="ds-empty">
              {tr('Введи имя клиента выше, чтобы добавить первую карточку', 'Введите имя клиента выше, чтобы добавить первую карточку')}
            </p>
          ) : filtered.length === 0 ? (
            <p className="ds-empty">Ничего не найдено</p>
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
