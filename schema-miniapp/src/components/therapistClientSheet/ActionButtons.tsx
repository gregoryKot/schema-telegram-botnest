import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import { ClientDetail } from './types';

interface ActionButtonsProps {
  detail: ClientDetail;
}

/**
 * Строка-переход кабинета: название, подпись, шеврон. Без иконки-плашки —
 * различие несут название и подпись (как в ToolRow мини-аппа). После отказа
 * от эмодзи четыре строки стали структурно одинаковыми, поэтому живут одним
 * компонентом: правка доезжает до всех сразу.
 */
function ActionRow({
  label,
  sub,
  subFaint,
  onClick,
}: {
  label: string;
  sub?: React.ReactNode;
  subFaint?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      {...pressable(onClick)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-12)',
        background: 'rgba(var(--fg-rgb),0.04)',
        border: '1px solid rgba(var(--fg-rgb),0.08)',
        borderRadius: 'var(--r-14)',
        padding: '13px 16px',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: subFaint ? 'var(--text-faint)' : 'var(--text-sub)',
              marginTop: 1,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
    </div>
  );
}

export function ActionButtons({ detail }: ActionButtonsProps) {
  const {
    clientTasks,
    notes,
    concept,
    clientSchemaNotesData,
    clientModeNotesData,
    setShowTasksSheet,
    setShowNotesSheet,
    setShowConceptSheet,
    setShowClientNotesSheet,
  } = detail;

  const activeTasks = clientTasks.filter(
    (t) => t.done === null && !t.doneToday,
  ).length;
  const clientCards = clientSchemaNotesData.length + clientModeNotesData.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      <ActionRow
        label="Задания"
        sub={activeTasks > 0 ? `${activeTasks} активных` : undefined}
        onClick={() => setShowTasksSheet(true)}
      />
      <ActionRow
        label="Заметки сессий"
        sub={notes.length > 0 ? `${notes.length} заметок` : undefined}
        onClick={() => setShowNotesSheet(true)}
      />
      <ActionRow
        label="Концептуализация"
        sub={
          concept?.updatedAt
            ? `Обновлено ${fmtDate(concept.updatedAt.slice(0, 10))}`
            : undefined
        }
        onClick={() => setShowConceptSheet(true)}
      />
      <ActionRow
        label="Записи клиента"
        sub={
          clientCards > 0
            ? `Схем: ${clientSchemaNotesData.length} · Режимов: ${clientModeNotesData.length}`
            : 'Карточки схем и режимов'
        }
        subFaint={clientCards === 0}
        onClick={() => setShowClientNotesSheet(true)}
      />
    </div>
  );
}
