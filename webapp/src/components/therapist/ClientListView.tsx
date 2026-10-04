import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { api } from '../../api';
import type { TherapyClientSummary, UserTask, UserId } from '../../api';
import { sameId } from '../../../../shared/src/utils/sameId';
// Не todayStr(): дни клиентов приезжают из API календарными (полночь UTC),
// и локальная дата машины с ними не совпадает в половине зон — см. шапку
// shared/src/utils/calendarDate.ts.
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { KanbanView } from './KanbanView';
import { AddClientForm } from './AddClientForm';
import { indexColor, isVirtualClient } from './clientSheetHelpers';
import { RosterRow, WELLBEING_HINT } from './RosterRow';
import { filterRoster, sortRoster } from './rosterModel';
import type { useAddClient } from './useAddClient';
type AllTasks = { clientId: UserId; clientName: string; tasks: UserTask[] }[] | null;

interface Props {
  animKey: number;
  clients: TherapyClientSummary[];
  loading: boolean;
  loadFailed: boolean;
  listTab: 'clients' | 'kanban';
  setListTab: React.Dispatch<React.SetStateAction<'clients' | 'kanban'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: 'all' | 'active' | 'wait' | 'virtual';
  setFilterStatus: React.Dispatch<React.SetStateAction<'all' | 'active' | 'wait' | 'virtual'>>;
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

  // Сбой ≠ пусто: канбан не должен показать терапевту пустую доску без
  // заданий на отказе запроса. Вынесено в функцию — переиспользуется и
  // первым кликом по вкладке, и кнопкой повтора внутри KanbanView.
  const loadAllTasks = () => {
    setAllTasksFailed(false);
    setAllTasksLoading(true);
    api.getAllTherapyTasks().then(setAllTasks).catch(() => setAllTasksFailed(true)).finally(() => setAllTasksLoading(false));
  };

  return (
    <div className="therapist-scroll therapist-scroll--list" key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>
      <div className="page-inner-wide">

        {/* ── Add client form (editorial style) ──────────────────────── */}
        <AddClientForm addClient={addClient} />

        {/* Clients section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="eyebrow u-mb6">Все клиенты</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {clients.length} <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-sub)' }}>
                {clients.length === 1 ? 'клиент' : clients.length < 5 ? 'клиента' : 'клиентов'} · {clients.filter(c => c.lastActiveDate === todayCalendarDate()).length} активны сегодня
              </span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 28 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${listTab === 'clients' ? 'is-active' : ''}`} onClick={() => setListTab('clients')}>
              Клиенты{clients.length > 0 && <span className="count">{clients.length}</span>}
            </button>
            <button className={`tab ${listTab === 'kanban' ? 'is-active' : ''}`} onClick={() => {
              setListTab('kanban');
              if (!allTasks && !allTasksLoading) loadAllTasks();
            }}>Задания</button>
          </div>
          {listTab === 'clients' && (<>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Найти клиента" className="input"
                   style={{ maxWidth: 320, background: 'transparent', borderColor: 'var(--line)' }} />
            <div style={{ display: 'flex', gap: 2 }}>
              {(['all', 'active', 'wait', 'virtual'] as const).map((k) => {
                const label = { all: 'Все', active: 'Активны', wait: 'Ждут', virtual: 'Оффлайн' }[k];
                return (
                  <button key={k} onClick={() => setFilterStatus(k)}
                          style={{ padding: '5px 12px', borderRadius: 'var(--r-6)', fontSize: 12.5, border: 'none', cursor: 'pointer',
                                   fontWeight: filterStatus === k ? 600 : 500,
                                   background: filterStatus === k ? 'var(--surface-3)' : 'transparent',
                                   color: filterStatus === k ? 'var(--text)' : 'var(--text-faint)' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </>)}
        </div>


        {/* Today dashboard – только если есть РЕАЛЬНЫЕ сегодняшние данные */}
        {!loading && clients.length > 0 && (() => {
          const today = todayCalendarDate();
          const sessionsToday = clients
            .filter(c => c.nextSession && c.nextSession.slice(0, 10) === today)
            .sort((a, b) => (a.nextSession ?? '').localeCompare(b.nextSession ?? ''));
          const activeToday = clients.filter(c => c.lastActiveDate === today);

          if (sessionsToday.length === 0 && activeToday.length === 0) return null;
          return (
            <div className="u-mb40">
              {sessionsToday.length > 0 && (
                <div className="section">
                  <div className="section-head">
                    <h3>Сессии сегодня</h3>
                    <span className="hint">{sessionsToday.length} {sessionsToday.length === 1 ? 'встреча' : sessionsToday.length < 5 ? 'встречи' : 'встреч'}</span>
                  </div>
                  {sessionsToday.map(client => {
                    const [, timePart] = (client.nextSession ?? '').includes('T') ? (client.nextSession ?? '').split('T') : ['', null];
                    const name = client.clientAlias ?? client.name ?? `ID ${client.telegramId}`;
                    return (
                      <div key={client.telegramId} className="list-line" {...pressable(() => openClient(client))} style={{ cursor: 'pointer' }}>
                        <span className="num text-md" style={{ width: 52, flexShrink: 0, color: 'var(--text-sub)', fontWeight: 500 }}>{timePart ?? '–'}</span>
                        <div className="u-fill">
                          <div className="text-md u-w600">{name}</div>
                          {client.streak > 0 && <div className="text-xs muted u-mt3">{client.streak} дн. подряд</div>}
                        </div>
                        <span className="link">открыть →</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeToday.length > 0 && (
                <div className="section">
                  <div className="section-head">
                    <h3>Активны сегодня</h3>
                    <span className="hint">{activeToday.length} из {clients.length}</span>
                  </div>
                  <div className="u-wrap8">
                    {activeToday.map(client => (
                      <button
                        key={client.telegramId}
                        onClick={() => openClient(client)}
                        style={{ padding: '6px 12px', borderRadius: 'var(--r-20)', border: '1px solid var(--line)', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
                        {client.clientAlias ?? client.name ?? `ID ${client.telegramId}`}
                        {client.todayIndex !== null && (
                          <span className="num text-xs" style={{ color: indexColor(client.todayIndex) }}>{client.todayIndex.toFixed(1)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Kanban view ── */}
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

        {/* Client roster */}
        {listTab === 'clients' && (
          loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка...</div>
          ) : loadFailed ? (
            // Сбой ≠ пусто (CLAUDE.md: никаких заглушек вместо данных) —
            // терапевт с полным ростером не должен увидеть «клиентов нет».
            <div style={{ padding: '24px 0', color: 'var(--accent-red)', fontSize: 14 }}>
              {tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')}
            </div>
          ) : clients.length === 0 ? (
            <div style={{ padding: '24px 0', color: 'var(--text-faint)', fontSize: 14 }}>
              {tr('Введи имя клиента выше, чтобы добавить первую карточку', 'Введите имя клиента выше, чтобы добавить первую карточку')}
            </div>
          ) : (() => {
            const today = todayCalendarDate();
            const filtered = sortRoster(filterRoster(clients, searchQuery, filterStatus, today), today);
            // Колонка самочувствия — только если есть хоть один клиент с Telegram:
            // у офлайн-клиента нет ни индекса, ни спарклайна.
            const showState = filtered.some(c => !isVirtualClient(c));
            return (
              <div className={showState ? 'r-roster' : 'r-roster r-roster--no-state'}>
                {filtered.length === 0 ? (
                  <div className="text-md muted" style={{ padding: '24px 0' }}>Ничего не найдено</div>
                ) : (
                  <>
                    <div className="r-row-head">
                      <span className="eyebrow">Клиент</span>
                      <span className="eyebrow">Следующая встреча</span>
                      {showState && <span className="eyebrow" title={WELLBEING_HINT}>Самочувствие</span>}
                      <span className="eyebrow">Активные схемы</span>
                    </div>
                    {filtered.map(client => (
                      <RosterRow key={client.telegramId} client={client} today={today} showState={showState} onOpen={openClient} />
                    ))}
                  </>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
