import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type { TherapyClientSummary, UserTask } from '../../api';
import { fmtDate, todayStr } from '../../utils/format';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { RosterSparkline } from './Sparklines';
import { KanbanView } from './KanbanView';
import type { useAddClient } from './useAddClient';
import { nextSessionLabel, indexColor } from './sheetHelpers';

type AllTasks = { clientId: number; clientName: string; tasks: UserTask[] }[] | null;

interface Props {
  clients: TherapyClientSummary[];
  loading: boolean;
  listTab: 'clients' | 'kanban';
  setListTab: React.Dispatch<React.SetStateAction<'clients' | 'kanban'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: 'all' | 'active' | 'wait' | 'virtual';
  setFilterStatus: React.Dispatch<React.SetStateAction<'all' | 'active' | 'wait' | 'virtual'>>;
  allTasks: AllTasks;
  allTasksLoading: boolean;
  setAllTasks: React.Dispatch<React.SetStateAction<AllTasks>>;
  setAllTasksLoading: React.Dispatch<React.SetStateAction<boolean>>;
  animKey: number;
  openClient: (client: TherapyClientSummary) => void;
  add: ReturnType<typeof useAddClient>;
}

export function ClientListView({
  clients, loading, listTab, setListTab, searchQuery, setSearchQuery,
  filterStatus, setFilterStatus, allTasks, allTasksLoading, setAllTasks, setAllTasksLoading,
  animKey, openClient, add,
}: Props) {
  const tr = useTr();
  const {
    name: addName, setName: setAddName,
    withInvite, setWithInvite,
    created: addCreated, submitting: addSubmitting, error: addError, copied: addCopied, valid: addValid,
    inputRef: addInputRef,
    submit: submitAddClient, reset: resetAddClient, copyInvite: copyAddInvite,
  } = add;

  return (
    <div className="therapist-scroll therapist-scroll--list" key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>
      <div className="page-inner-wide">

        {/* ── Add client form (editorial style) ──────────────────────── */}
        <div style={{ paddingBottom: 48, borderBottom: '1px solid var(--line)', marginBottom: 48 }}>
          {addCreated ? (
            /* Success state */
            <div style={{ animation: 'fade-in 0.25s ease' }}>
              <div className="eyebrow" style={{ marginBottom: 20, color: 'var(--c-moss)' }}>Клиент добавлен</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 20px', lineHeight: 1.1, color: 'var(--text)' }}>
                {addCreated.name}
              </h2>
              {addCreated.inviteUrl ? (
                <div style={{ marginBottom: 24, maxWidth: 520 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Ссылка-приглашение</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--text-sub)', background: 'rgba(var(--fg-rgb),0.05)', padding: '9px 13px', borderRadius: 8, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {addCreated.inviteUrl}
                    </code>
                    <button
                      onClick={copyAddInvite}
                      style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: addCopied ? 'var(--c-moss)' : 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.2s' }}
                    >
                      {addCopied ? '✓ Скопировано' : 'Скопировать'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                    Клиент перейдёт по ссылке и автоматически подключится через бот
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: 440 }}>
                  Добавлен как оффлайн-клиент — записи и концептуализация без привязки к боту.
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={resetAddClient}
                  style={{ padding: '9px 20px', borderRadius: 20, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  Добавить ещё
                </button>
                <button
                  onClick={resetAddClient}
                  style={{ padding: '9px 20px', borderRadius: 20, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}
                >
                  к списку
                </button>
              </div>
            </div>
          ) : (
            /* Form state */
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Новый клиент</div>
              <h1 className="hub-title" style={{ marginBottom: 8 }}>Добавить клиента</h1>
              <p className="hub-sub" style={{ marginBottom: 28 }}>
                {tr('Введи имя — создастся оффлайн-карточка. Ссылку для подключения через бот — опционально.', 'Введите имя — создастся оффлайн-карточка. Ссылку для подключения через бот — опционально.')}
              </p>

              {/* Underline field */}
              <div style={{ borderBottom: `1.5px solid ${addName.length >= 2 ? 'var(--text)' : 'rgba(var(--fg-rgb),0.2)'}`, display: 'flex', alignItems: 'center', gap: 16, maxWidth: 480, marginBottom: 20, transition: 'border-color 0.2s' }}>
                <input
                  ref={addInputRef}
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitAddClient()}
                  placeholder="Имя клиента"
                  autoComplete="off"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 22, fontFamily: 'var(--serif)', color: 'var(--text)', padding: '6px 0', letterSpacing: '-0.01em' }}
                />
                <button
                  onClick={submitAddClient}
                  disabled={!addValid || addSubmitting}
                  style={{ padding: '7px 18px', borderRadius: 20, border: 'none', background: addValid ? 'var(--text)' : 'rgba(var(--fg-rgb),0.1)', color: addValid ? 'var(--bg)' : 'var(--text-faint)', fontSize: 13, fontWeight: 500, cursor: addValid ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}
                >
                  {addSubmitting ? '...' : 'Добавить'}
                </button>
              </div>

              {/* Invite toggle */}
              <button
                onClick={() => setWithInvite(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 480, background: 'none', border: 'none', padding: '11px 0', cursor: 'pointer', borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}
              >
                <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>Создать ссылку-приглашение</span>
                <div style={{ width: 38, height: 20, borderRadius: 10, background: withInvite ? 'var(--accent)' : 'var(--surface-3)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: withInvite ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                </div>
              </button>
              {withInvite && (
                <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, maxWidth: 440 }}>
                  После добавления появится ссылка — клиент перейдёт по ней и подключится через Telegram-бот
                </p>
              )}

              {addError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{addError}</div>}
            </div>
          )}
        </div>

        {/* Clients section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Все клиенты</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {clients.length} <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-sub)' }}>
                {clients.length === 1 ? 'клиент' : clients.length < 5 ? 'клиента' : 'клиентов'} · {clients.filter(c => c.lastActiveDate === todayStr()).length} активны сегодня
              </span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${listTab === 'clients' ? 'is-active' : ''}`} onClick={() => setListTab('clients')}>
              Клиенты{clients.length > 0 && <span className="count">{clients.length}</span>}
            </button>
            <button className={`tab ${listTab === 'kanban' ? 'is-active' : ''}`} onClick={() => {
              setListTab('kanban');
              if (!allTasks && !allTasksLoading) {
                setAllTasksLoading(true);
                api.getAllTherapyTasks().then(setAllTasks).catch(() => setAllTasks([])).finally(() => setAllTasksLoading(false));
              }
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
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12.5, border: 'none', cursor: 'pointer',
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
          const today = todayStr();
          const sessionsToday = clients
            .filter(c => c.nextSession && c.nextSession.slice(0, 10) === today)
            .sort((a, b) => (a.nextSession ?? '').localeCompare(b.nextSession ?? ''));
          const activeToday = clients.filter(c => c.lastActiveDate === today);

          if (sessionsToday.length === 0 && activeToday.length === 0) return null;
          return (
            <div style={{ marginBottom: 40 }}>
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
                      <div key={client.telegramId} className="list-line" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                        <span className="num text-md" style={{ width: 52, flexShrink: 0, color: 'var(--text-sub)', fontWeight: 500 }}>{timePart ?? '–'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-md" style={{ fontWeight: 600 }}>{name}</div>
                          {client.streak > 0 && <div className="text-xs muted" style={{ marginTop: 3 }}>{client.streak} дн. подряд</div>}
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {activeToday.map(client => (
                      <button
                        key={client.telegramId}
                        onClick={() => openClient(client)}
                        style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
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
            onOpenClient={(clientId) => {
              const client = clients.find(c => c.telegramId === clientId);
              if (client) openClient(client);
            }}
          />
        )}

        {/* Client roster */}
        {listTab === 'clients' && (
          loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка...</div>
          ) : clients.length === 0 ? (
            <div style={{ padding: '24px 0', color: 'var(--text-faint)', fontSize: 14 }}>
              {tr('Введи имя клиента выше, чтобы добавить первую карточку', 'Введите имя клиента выше, чтобы добавить первую карточку')}
            </div>
          ) : (() => {
            const today = todayStr();
            const q = searchQuery.toLowerCase().trim();
            let filtered = q ? clients.filter(c => (c.clientAlias ?? c.name ?? '').toLowerCase().includes(q)) : clients.slice();
            if (filterStatus === 'active') filtered = filtered.filter(c => c.lastActiveDate === today);
            else if (filterStatus === 'wait') filtered = filtered.filter(c => c.lastActiveDate !== today && !!c.name);
            else if (filterStatus === 'virtual') filtered = filtered.filter(c => !c.name);
            const hasOnline = filtered.some(c => !!c.name);
            return (
              <div>
                {filtered.length === 0 && (
                  <div className="text-md muted" style={{ padding: '24px 0' }}>Ничего не найдено</div>
                )}
                {hasOnline && (
                  <>
                    <div className="r-row-head">
                      <span className="eyebrow">Клиент</span>
                      <span className="eyebrow" style={{ textAlign: 'right' }}>Индекс</span>
                      <span className="eyebrow">14 дн.</span>
                      <span className="eyebrow">Активные схемы</span>
                    </div>
                    {filtered.filter(c => !!c.name).map(client => (
                      <div key={client.telegramId} className="r-row" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="text-base" style={{ fontWeight: 600 }}>{client.clientAlias ?? client.name}</span>
                            {client.lastActiveDate === today && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
                            )}
                          </div>
                          <div className="text-xs faint" style={{ marginTop: 3 }}>
                            {client.lastActiveDate === today ? 'активен сегодня' : client.lastActiveDate ? 'был недавно' : 'не активен'}
                            {client.streak > 0 && ` · стрик ${client.streak} дн.`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {client.todayIndex != null ? (
                            <span className="num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: indexColor(client.todayIndex) }}>{client.todayIndex.toFixed(1)}</span>
                          ) : <span className="text-sm faint">–</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <RosterSparkline values={(client.recentIndexHistory ?? []).slice().reverse()} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
                          {client.schemaIds.length > 0 ? client.schemaIds.slice(0, 3).map(id => {
                            const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
                            const schema = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === id);
                            return (
                              <span key={id} className="tag-mini">
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                                {schema?.name ?? id}
                              </span>
                            );
                          }) : <span className="text-xs faint">–</span>}
                          {client.schemaIds.length > 3 && <span className="text-xs faint">+{client.schemaIds.length - 3}</span>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {filtered.filter(c => !c.name).length > 0 && (
                  <div style={{ marginTop: hasOnline ? 32 : 0 }}>
                    {hasOnline && <div className="eyebrow" style={{ marginBottom: 12 }}>Оффлайн-клиенты</div>}
                    {filtered.filter(c => !c.name).map(client => {
                      const name = client.clientAlias ?? `ID ${client.telegramId}`;
                      return (
                        <div key={client.telegramId} className="list-line" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="text-md" style={{ fontWeight: 600 }}>{name}</span>
                              <span className="chip chip-line" style={{ fontSize: 11 }}>оффлайн</span>
                            </div>
                            <div className="text-sm muted" style={{ marginTop: 3 }}>
                              {client.therapyStartDate ? `с ${fmtDate(client.therapyStartDate)}` : 'без Telegram'}
                              {client.nextSession && ` · ${nextSessionLabel(client.nextSession)}`}
                            </div>
                          </div>
                          <span className="link">открыть →</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
