import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
// Местный день — для nextSession; активность клиента — по его календарю.
import { todayStr } from '../../utils/format';
import { SkeletonLines } from '../Skeleton';
import { AddClientForm } from './AddClientForm';
import { PendingInvitesList } from '../../../../shared/src/therapy/PendingInvitesList';
import { CardClaimBanner } from '../../../../shared/src/therapy/CardClaimBanner';
import { ClientCard, ClientRosterHead } from './ClientCard';
import { PaperEmpty } from '../art/PaperEmpty';
import { PaperAlert } from '../paper/PaperAlert';
import { SignArt } from '../art/SignArt';
import { Sheets } from '../art/PaperArt';
import { ClientListHero } from './ClientListHero';
import { CLAIM_SIGN, INVITE_SIGN } from './cabinetLook';
import { filterRoster, sortRoster, type RosterStatus } from './rosterModel';
import { StatusFilter } from './StatusFilter';
import type { useAddClient } from './useAddClient';
import type { ClientTaskDigests } from './useClientTaskDigests';
import { rosterTasksMark } from '../../../../shared/src/tasks/taskDigest';
import type { ClientTab } from './clientSheetTypes';
import '../../styles/therapist-clients.css';

interface Props {
  animKey: number;
  clients: TherapyClientSummary[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: RosterStatus;
  setFilterStatus: React.Dispatch<React.SetStateAction<RosterStatus>>;
  /** Сводка заданий клиента — тихая отметка «выполнено с прошлой встречи» в его строке. */
  digestOf?: ClientTaskDigests['digestOf'];
  openClient: (client: TherapyClientSummary, tab?: ClientTab) => void;
  addClient: ReturnType<typeof useAddClient>;
}

const signOf = (sign: typeof INVITE_SIGN) => <span className="tc-block-sign" aria-hidden="true"><SignArt sign={sign} size="row" /></span>;
const markOf = (d: ReturnType<ClientTaskDigests['digestOf']>) => (d ? rosterTasksMark(d) : null);
const blockAlert = (sign: typeof INVITE_SIGN) => (text: string) => <PaperAlert sign={sign} title={text} />;

export function ClientListView({
  animKey, clients, loading, loadFailed, onRetry, searchQuery, setSearchQuery,
  filterStatus, setFilterStatus, digestOf, openClient, addClient,
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
        <ClientListHero count={clients.length} formVisible={formVisible} onToggle={() => addClient.setOpen(v => !v)} />
        <CardClaimBanner claims={addClient.claims} rowClassName="pp-block tc-claim" art={signOf(CLAIM_SIGN)} failure={blockAlert(CLAIM_SIGN)} />
        {formVisible && <AddClientForm addClient={addClient} />}
        <PendingInvitesList pending={addClient.pending} className="pp-block tc-pending" art={signOf(INVITE_SIGN)} failure={blockAlert(INVITE_SIGN)} />
        {!noClients && (
          <div className="tc-toolbar">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} type="search"
                   placeholder="Найти клиента" aria-label="Найти клиента" className="ds-input ds-input--search tc-search" />
            <StatusFilter value={filterStatus} onChange={setFilterStatus} />
          </div>
        )}

        {loading ? (
          <div className="ds-rows" aria-hidden>
            {[0, 1, 2, 3].map(i => <div key={i} className="tc-row-skel"><SkeletonLines widths={['45%', '70%']} /></div>)}
          </div>
        ) : loadFailed ? (
          // Сбой ≠ пусто: полный ростер не должен выглядеть как «клиентов нет».
          <PaperAlert sign="cluster" className="tc-error" onRetry={onRetry}
            title={tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')} />
        ) : clients.length === 0 ? (
          // Пустой список — пустое состояние на бумаге (К18); главное действие — открытая форма выше.
          <PaperEmpty art={Sheets} title="Клиентов пока нет">{tr('Введи имя клиента выше — появится первая карточка', 'Введите имя клиента выше — появится первая карточка')}</PaperEmpty>
        ) : filtered.length === 0 ? (
          <PaperEmpty>Ничего не найдено</PaperEmpty>
        ) : (
          <div className="ds-rows tc-rows">
            <ClientRosterHead />
            {filtered.map(client => (
              <ClientCard key={client.telegramId} client={client} today={today} onOpen={openClient}
                tasksMark={digestOf ? markOf(digestOf(client)) : null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
