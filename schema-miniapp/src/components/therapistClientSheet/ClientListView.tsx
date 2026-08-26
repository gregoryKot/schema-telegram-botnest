import { SkeletonList } from '../Skeleton';
import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { ClientDetail, AddClient } from './types';
import { WebBanner } from '../WebBanner';
import { WEB_CABINET_URL } from '../../utils/webBanner';
import { ClientCard } from './ClientCard';
import { StatCards } from './StatCards';
import { ListEmptyState } from './ListEmptyState';
import { InvitePanel } from './addPanels/InvitePanel';
import { AddInputPanel } from './addPanels/AddInputPanel';
import { AddModeTabs } from './addPanels/AddModeTabs';

interface ClientListViewProps {
  clients: TherapyClientSummary[];
  loading: boolean;
  loadFailed?: boolean;
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
  loadFailed = false,
  today,
  safeTop,
  animKey,
  onClose,
  telegramInputRef,
  virtualInputRef,
  detail,
  addClient,
}: ClientListViewProps) {
  const slideStyle: React.CSSProperties = {
    animation: 'fade-in 0.22s ease',
  };
  const { openClient } = detail;
  const {
    addMode,
    setAddMode,
    setAddInput,
    addError,
    setAddError,
    openAddMode,
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
                gap: 'var(--space-10)',
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
                  borderRadius: 'var(--r-20)',
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
          <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 4 }}>
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
            <AddModeTabs
              addMode={addMode}
              onPick={(mode) => {
                setAddMode(mode);
                setAddInput('');
                setAddError('');
              }}
            />

            {addMode === 'invite' && <InvitePanel addClient={addClient} />}

            {addMode === 'telegram' && (
              <AddInputPanel
                addClient={addClient}
                inputRef={telegramInputRef}
                onSubmit={addClient.addByTelegramId}
                placeholder="Telegram ID клиента"
                inputMode="numeric"
                submitLabel="Добавить"
                hint="Клиент должен хотя бы раз открыть приложение"
              />
            )}

            {addMode === 'virtual' && (
              <AddInputPanel
                addClient={addClient}
                inputRef={virtualInputRef}
                onSubmit={addClient.addVirtualClient}
                placeholder="Имя клиента"
                submitLabel="Создать"
                accent
                hint="Для работы без Telegram: заметки, концептуализация, задания"
              />
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
        ) : loadFailed || clients.length === 0 ? (
          <ListEmptyState failed={loadFailed} />
        ) : (
          clients.map((c) => (
            <ClientCard
              key={c.telegramId}
              client={c}
              today={today}
              onOpen={openClient}
            />
          ))
        )}

        {/* Invite button */}
        {!loading && clients.length > 0 && (
          <div
            {...pressable(() => openAddMode('invite'))}
            style={{
              border: '1px dashed rgba(var(--fg-rgb),0.18)',
              borderRadius: 'var(--r-16)',
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
