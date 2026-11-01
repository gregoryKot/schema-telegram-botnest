import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ConfirmButtons } from './ConfirmButtons';
import { useConfirmedAction } from '../../../../shared/src/hooks/useConfirmedAction';
import { leaveTherapyCopy } from '../../../../shared/src/therapy/therapistLinkCopy';

// «Отключиться от терапевта» в «Мой терапевт» мини-аппа: подтверждение прямо
// на месте кнопки, как у «Удалить результаты теста» (YsqDataDelete.tsx).
// Инцидент 2026-10-26: связь удалялась одним тапом, вернуть её можно только
// новым кодом от терапевта. Состояние «спросили → отключаем → ошибка» и
// тексты — общие с сайтом (useConfirmedAction, leaveTherapyCopy); пара —
// MyTherapistSection в webapp/src/components/settingsSheet/TherapistSections.tsx.
export function LeaveTherapy({ onLeft }: { onLeft: () => void }) {
  const copy = leaveTherapyCopy(useTr());
  const leave = useConfirmedAction(() => api.leaveTherapy(), onLeft);

  if (!leave.confirming)
    return (
      <button
        onClick={leave.ask}
        style={{
          background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
          borderRadius: 'var(--r-10)',
          padding: '8px 16px',
          color: 'var(--accent-red)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {copy.button}
      </button>
    );

  return (
    <div role="group" aria-label={copy.title}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 6,
        }}
      >
        {copy.title}
      </div>
      <div className="u-sub13-lh16" style={{ marginBottom: 12 }}>
        {copy.message}
      </div>
      {leave.failed && (
        <div
          role="alert"
          style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 10 }}
        >
          {copy.error}
        </div>
      )}
      <ConfirmButtons
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        busy={leave.busy}
        busyLabel={copy.busy}
        onConfirm={() => void leave.confirm()}
        onCancel={leave.cancel}
      />
    </div>
  );
}
