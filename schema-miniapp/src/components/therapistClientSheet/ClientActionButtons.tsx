import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './types';

interface Props {
  detail: ClientDetail;
}

export function ClientActionButtons({ detail }: Props) {
  const {
    setShowTasksSheet,
    clientTasks,
    setShowNotesSheet,
    notes,
    setShowConceptSheet,
    concept,
    setShowClientNotesSheet,
    clientSchemaNotesData,
    clientModeNotesData,
  } = detail;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        onClick={() => setShowTasksSheet(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 14,
          padding: '13px 16px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Задания
          </div>
          {clientTasks.filter((t) => t.done === null && !t.doneToday).length >
            0 && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginTop: 1,
              }}
            >
              {
                clientTasks.filter((t) => t.done === null && !t.doneToday)
                  .length
              }{' '}
              активных
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
      </div>
      <div
        onClick={() => setShowNotesSheet(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 14,
          padding: '13px 16px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>📝</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Заметки сессий
          </div>
          {notes.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginTop: 1,
              }}
            >
              {notes.length} заметок
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
      </div>
      <div
        onClick={() => setShowConceptSheet(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 14,
          padding: '13px 16px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>🗂</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Концептуализация
          </div>
          {concept?.updatedAt && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginTop: 1,
              }}
            >
              Обновлено {fmtDate(concept.updatedAt.slice(0, 10))}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
      </div>
      <div
        onClick={() => setShowClientNotesSheet(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 14,
          padding: '13px 16px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>📖</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Записи клиента
          </div>
          {clientSchemaNotesData.length + clientModeNotesData.length > 0 ? (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginTop: 1,
              }}
            >
              Схем: {clientSchemaNotesData.length} · Режимов:{' '}
              {clientModeNotesData.length}
            </div>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                marginTop: 1,
              }}
            >
              Карточки схем и режимов
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
      </div>
    </div>
  );
}
