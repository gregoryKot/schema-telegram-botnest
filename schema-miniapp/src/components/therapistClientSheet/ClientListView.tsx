import { useTr } from '../../utils/addressForm';
import { SkeletonList } from '../Skeleton';
import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { AddMode } from '../therapist/useAddClient';
import { indexColor } from './helpers';
import { ClientDetail, AddClient } from './types';
import { WebBanner } from '../WebBanner';
import { WEB_CABINET_URL } from '../../utils/webBanner';
import { RosterSparkline } from '../../../../shared/src/components/Sparklines';
import { StatCards } from './StatCards';

interface ClientListViewProps {
  clients: TherapyClientSummary[];
  loading: boolean;
  today: string;
  safeTop: number;
  animKey: number;
  onClose: () => void;
  telegramInputRef: React.RefObject<HTMLInputElement | null>;
  virtualInputRef: React.RefObject<HTMLInputElement | null>;
  detail: ClientDetail;
  addClient: AddClient;
}

export function ClientListView({
  clients,
  loading,
  today,
  safeTop,
  animKey,
  onClose,
  telegramInputRef,
  virtualInputRef,
  detail,
  addClient,
}: ClientListViewProps) {
  const tr = useTr();
  const slideStyle: React.CSSProperties = {
    animation: 'fade-in 0.22s ease',
  };
  const { openClient } = detail;
  const {
    addMode,
    setAddMode,
    addInput,
    setAddInput,
    addError,
    setAddError,
    inviteUrl,
    setInviteUrl,
    inviteCopied,
    setInviteCopied,
    inviteLoading,
    inviteInputRef,
    openAddMode,
    createInvite,
    copyInvite,
    shareInvite,
    addByTelegramId,
    addVirtualClient,
    addLoading,
  } = addClient;

  return (
    <div style={{ padding: `${safeTop + 20}px 20px 100px` }}>
      <div key={`list-${animKey}`} style={slideStyle}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--text)',
                  letterSpacing: '-0.5px',
                }}
              >
                Кабинет
              </div>
              <div
                style={{
                  background:
                    'color-mix(in srgb, var(--accent) 20%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                  borderRadius: 20,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  letterSpacing: '0.03em',
                }}
              >
                психолог
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.4,
              }}
            >
              Клиенты · Задания · Концептуализация
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {/* Exit therapist mode — always visible escape hatch */}
            <button
              onClick={onClose}
              title="Вернуться в приложение"
              aria-label="Вернуться в приложение"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                background: 'rgba(var(--fg-rgb),0.07)',
                color: 'var(--text-faint)',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
            <button
              onClick={() => openAddMode(addMode ? null : 'invite')}
              aria-label={addMode ? 'Закрыть' : 'Добавить клиента'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                background: addMode
                  ? 'rgba(var(--fg-rgb),0.08)'
                  : 'color-mix(in srgb, var(--accent) 20%, transparent)',
                color: addMode ? 'rgba(var(--fg-rgb),0.5)' : 'var(--accent)',
                fontSize: addMode ? 18 : 22,
                fontWeight: 300,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {addMode ? '✕' : '+'}
            </button>
          </div>
        </div>

        {/* Stat cards — вынесены в StatCards (правило №10) */}
        {!loading && <StatCards clients={clients} today={today} />}

        {/* Полная версия кабинета — на сайте (скрываемый баннер) */}
        {!loading && (
          <WebBanner
            id="cabinet_full"
            emoji="🖥"
            title="Полная версия кабинета — на сайте"
            text="На schemehappens.ru: карта режимов клиента, канбан-доска, дашборд дня и большой экран для сессий. Вход через Telegram — данные общие с мини-аппом."
            url={WEB_CABINET_URL}
          />
        )}

        {/* Add client panel */}
        {addMode !== null && (
          <div
            style={{
              background: 'rgba(var(--fg-rgb),0.03)',
              border: '1px solid rgba(var(--fg-rgb),0.08)',
              borderRadius: 18,
              padding: 16,
              marginBottom: 20,
              animation: 'fade-in 0.18s ease',
            }}
          >
            {/* Mode selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(
                [
                  ['invite', '🔗', 'Ссылка'],
                  ['telegram', '📱', 'Telegram ID'],
                  ['virtual', '👤', 'Оффлайн'],
                ] as [AddMode, string, string][]
              ).map(([mode, icon, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    setAddMode(mode);
                    setAddInput('');
                    setAddError('');
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    borderRadius: 12,
                    border: 'none',
                    background:
                      addMode === mode
                        ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                        : 'rgba(var(--fg-rgb),0.05)',
                    color:
                      addMode === mode
                        ? 'var(--accent)'
                        : 'rgba(var(--fg-rgb),0.4)',
                    fontSize: 12,
                    fontWeight: addMode === mode ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Invite form */}
            {addMode === 'invite' && (
              <>
                {!inviteUrl ? (
                  <button
                    onClick={createInvite}
                    disabled={inviteLoading}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 12,
                      border: 'none',
                      background:
                        'color-mix(in srgb, var(--accent) 20%, transparent)',
                      color: 'var(--accent)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: inviteLoading ? 0.6 : 1,
                    }}
                  >
                    {inviteLoading ? 'Создаю...' : 'Создать ссылку'}
                  </button>
                ) : (
                  <>
                    <input
                      ref={inviteInputRef}
                      readOnly
                      value={inviteUrl}
                      onClick={() => inviteInputRef.current?.select()}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        marginBottom: 10,
                        background: 'rgba(var(--fg-rgb),0.05)',
                        border: '1px solid rgba(var(--fg-rgb),0.1)',
                        borderRadius: 10,
                        padding: '9px 12px',
                        outline: 'none',
                        cursor: 'text',
                        color: 'var(--text-sub)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={copyInvite}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: inviteCopied
                            ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)'
                            : 'rgba(var(--fg-rgb),0.07)',
                          color: inviteCopied
                            ? '#06d6a0'
                            : 'rgba(var(--fg-rgb),0.6)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {inviteCopied ? '✓ Скопировано' : 'Скопировать'}
                      </button>
                      <button
                        onClick={shareInvite}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          borderRadius: 10,
                          border: 'none',
                          background:
                            'color-mix(in srgb, var(--accent) 15%, transparent)',
                          color: 'var(--accent)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Поделиться
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setInviteUrl('');
                        setInviteCopied(false);
                      }}
                      style={{
                        width: '100%',
                        marginTop: 8,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-faint)',
                        fontSize: 12,
                        cursor: 'pointer',
                        padding: '4px 0',
                      }}
                    >
                      Создать новую
                    </button>
                  </>
                )}
              </>
            )}

            {/* Telegram ID form */}
            {addMode === 'telegram' && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={addInput}
                    onChange={(e) => {
                      setAddInput(e.target.value);
                      setAddError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addByTelegramId()}
                    placeholder="Telegram ID клиента"
                    inputMode="numeric"
                    ref={telegramInputRef}
                    style={{
                      flex: 1,
                      background: 'rgba(var(--fg-rgb),0.06)',
                      border: `1px solid ${addError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                      borderRadius: 10,
                      padding: '9px 12px',
                      outline: 'none',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={addByTelegramId}
                    disabled={addLoading || !addInput.trim()}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: addInput.trim()
                        ? 'rgba(var(--fg-rgb),0.12)'
                        : 'rgba(var(--fg-rgb),0.05)',
                      color: addInput.trim()
                        ? 'var(--text)'
                        : 'rgba(var(--fg-rgb),0.3)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: addInput.trim() ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  >
                    {addLoading ? '...' : 'Добавить'}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    marginTop: 6,
                  }}
                >
                  Клиент должен хотя бы раз открыть приложение
                </div>
              </>
            )}

            {/* Virtual client form */}
            {addMode === 'virtual' && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={addInput}
                    onChange={(e) => {
                      setAddInput(e.target.value);
                      setAddError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addVirtualClient()}
                    placeholder="Имя клиента"
                    ref={virtualInputRef}
                    style={{
                      flex: 1,
                      background: 'rgba(var(--fg-rgb),0.06)',
                      border: `1px solid ${addError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                      borderRadius: 10,
                      padding: '9px 12px',
                      outline: 'none',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={addVirtualClient}
                    disabled={addLoading || !addInput.trim()}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: addInput.trim()
                        ? 'var(--accent)'
                        : 'rgba(var(--fg-rgb),0.05)',
                      color: addInput.trim()
                        ? '#fff'
                        : 'rgba(var(--fg-rgb),0.3)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: addInput.trim() ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  >
                    {addLoading ? '...' : 'Создать'}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    marginTop: 6,
                  }}
                >
                  Для работы без Telegram: заметки, концептуализация, задания
                </div>
              </>
            )}

            {addError && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  marginTop: 8,
                }}
              >
                {addError}
              </div>
            )}
          </div>
        )}

        {/* Client list */}
        {loading ? (
          <SkeletonList rows={4} h={72} />
        ) : clients.length === 0 ? (
          <div
            style={{
              color: 'var(--text-sub)',
              fontSize: 14,
              textAlign: 'center',
              paddingTop: 20,
              lineHeight: 1.8,
            }}
          >
            Нет подключённых клиентов.
            <br />
            {tr('Нажми', 'Нажмите')}{' '}
            <strong style={{ color: 'var(--accent)' }}>+</strong> чтобы
            добавить.
          </div>
        ) : (
          clients.map((c) => {
            const isToday = c.lastActiveDate === today;
            const isVirtual = c.telegramId < 0;
            const displayName =
              c.clientAlias ??
              c.name ??
              (isVirtual ? 'Оффлайн' : `ID ${c.telegramId}`);
            const initials = displayName
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const avatarColors = [
              '#a78bfa',
              '#60a5fa',
              '#f472b6',
              '#34d399',
              '#fb923c',
              '#facc15',
            ];
            const avatarColor =
              avatarColors[Math.abs(c.telegramId) % avatarColors.length];
            return (
              <div
                key={c.telegramId}
                {...pressable(() => openClient(c))}
                className="card"
                style={{
                  borderRadius: 16,
                  padding: '14px 16px',
                  marginBottom: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {initials || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: 2,
                    }}
                  >
                    {displayName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                    {isVirtual
                      ? 'Без Telegram'
                      : `${isToday ? 'Сегодня' : c.lastActiveDate ? fmtDate(c.lastActiveDate) : 'Не активен'} · Стрик ${c.streak} дн`}
                  </div>
                  {/* Динамика индекса за 14 дней (index 0 = сегодня →
                      разворачиваем). Меньше 2 точек — не занимаем место. */}
                  {(c.recentIndexHistory ?? []).filter((v) => v != null)
                    .length >= 2 && (
                    <RosterSparkline
                      values={(c.recentIndexHistory ?? []).slice().reverse()}
                    />
                  )}
                </div>
                {c.todayIndex !== null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: indexColor(c.todayIndex),
                        lineHeight: 1,
                      }}
                    >
                      {c.todayIndex.toFixed(1)}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginTop: 2,
                      }}
                    >
                      индекс
                    </div>
                  </div>
                )}
                <span
                  style={{
                    color: 'var(--text-faint)',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  ›
                </span>
              </div>
            );
          })
        )}

        {/* Invite button */}
        {!loading && clients.length > 0 && (
          <div
            {...pressable(() => openAddMode('invite'))}
            style={{
              border: '1px dashed rgba(var(--fg-rgb),0.18)',
              borderRadius: 16,
              padding: '14px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--text-sub)',
              fontSize: 14,
            }}
          >
            + Пригласить клиента
          </div>
        )}
      </div>
    </div>
  );
}
