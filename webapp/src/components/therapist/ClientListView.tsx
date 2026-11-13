import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
import { sameId } from '../../../../shared/src/utils/sameId';
// Местный день — для nextSession; активность клиента — по его календарю.
import { todayStr } from '../../utils/format';
import { Skeleton } from '../Skeleton';
import { KanbanView } from './KanbanView';
import { AddClientForm } from './AddClientForm';
import { PendingInvitesList } from '../../../../shared/src/therapy/PendingInvitesList';
import { CardClaimBanner } from '../../../../shared/src/therapy/CardClaimBanner';
import { ClientCard } from './ClientCard';
import { PaperEmpty } from '../art/PaperEmpty';
import { PaperAlert } from '../paper/PaperAlert';
import { SignArt } from '../art/SignArt';
import { ClientListHero } from './ClientListHero';
import { CabinetEmpty } from './CabinetEmpty';
import { CLAIM_SIGN, INVITE_SIGN } from './cabinetLook';
import { filterRoster, sortRoster, type RosterStatus } from './rosterModel';
import { StatusFilter } from './StatusFilter';
import type { useAddClient } from './useAddClient';
import type { TasksBoard } from './useTasksBoard';
import type { ClientTab } from './clientSheetTypes';
import '../../styles/therapist-clients.css';

interface Props {
  animKey: number;
  clients: TherapyClientSummary[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  listTab: 'clients' | 'kanban';
  setListTab: (t: 'clients' | 'kanban') => void;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: RosterStatus;
  setFilterStatus: React.Dispatch<React.SetStateAction<RosterStatus>>;
  /** Доска «Задания» — её держит лист кабинета (useTasksBoard). */
  board: TasksBoard;
  openClient: (client: TherapyClientSummary, tab?: ClientTab) => void;
  addClient: ReturnType<typeof useAddClient>;
  /** Палитра «Перейти к…» — кнопка-лупа в шапке на телефоне (у оболочки там нет строки .topbar). */
  onSearch?: () => void;
}

const signOf = (sign: typeof INVITE_SIGN) => <span className="tc-block-sign" aria-hidden="true"><SignArt sign={sign} size="row" /></span>;
const blockAlert = (sign: typeof INVITE_SIGN) => (text: string) => <PaperAlert sign={sign} title={text} />;

export function ClientListView({
  animKey, clients, loading, loadFailed, onRetry, listTab, setListTab, searchQuery, setSearchQuery,
  filterStatus, setFilterStatus, board, openClient, addClient, onSearch,
}: Props) {
  const tr = useTr();
  // Пустой список — онбординг (форма сразу); созданного клиента не прячем, пока не увидена ссылка (created).
  const noClients = !loading && !loadFailed && clients.length === 0;
  const formVisible = addClient.open || noClients || addClient.created !== null;

  const today = todayStr();
  const filtered = sortRoster(filterRoster(clients, searchQuery, filterStatus), today);

  return (
    <div className="therapist-scroll therapist-scroll--list" key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>
      <div className="ds-page">
        <ClientListHero count={clients.length} formVisible={formVisible} onToggle={() => addClient.setOpen(v => !v)} onSearch={onSearch} />

        <CardClaimBanner claims={addClient.claims} rowClassName="pp-leaf tc-claim" art={signOf(CLAIM_SIGN)} failure={blockAlert(CLAIM_SIGN)} />
        {formVisible && <AddClientForm addClient={addClient} />}
        <PendingInvitesList pending={addClient.pending} className="pp-leaf tc-pending" art={signOf(INVITE_SIGN)} failure={blockAlert(INVITE_SIGN)} />

        <div className="tc-toolbar">
          <div className="tc-modes">
            <div className="ds-seg ds-seg--full" role="tablist">
              <button role="tab" aria-selected={listTab === 'clients'} className={`ds-seg-btn ${listTab === 'clients' ? 'is-active' : ''}`}
                      onClick={() => setListTab('clients')}>Клиенты</button>
              <button role="tab" aria-selected={listTab === 'kanban'} className={`ds-seg-btn ${listTab === 'kanban' ? 'is-active' : ''}`}
                      onClick={() => { setListTab('kanban'); board.open(); }}>Задания</button>
            </div>
            {listTab === 'clients' && !noClients && (
              <StatusFilter value={filterStatus} onChange={setFilterStatus} />
            )}
          </div>
          {listTab === 'clients' && !noClients && (
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
              {[0, 1, 2, 3].map(i => <Skeleton key={i} height="var(--tc-card-h)" radius={20} />)}
            </div>
          ) : loadFailed ? (
            // Сбой ≠ пусто: полный ростер не должен выглядеть как «клиентов нет».
            <PaperAlert sign="cluster" className="tc-error" onRetry={onRetry}
              title={tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')} />
          ) : clients.length === 0 ? (
            // Пустой список — одна сцена кабинета; главное действие — открытая форма выше.
            <CabinetEmpty text={tr('Введи имя клиента выше, чтобы добавить первую карточку', 'Введите имя клиента выше, чтобы добавить первую карточку')} />
          ) : filtered.length === 0 ? (
            <PaperEmpty>Ничего не найдено</PaperEmpty>
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
