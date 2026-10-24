import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ConfirmButtons } from './ConfirmButtons';
import {
  buildYsqDataDeleteCopy,
  useYsqDataDelete,
} from '../../../../shared/src/hooks/ysqDataDelete';

// «Удалить результаты теста» в шторке «Конфиденциальность» (PrivacyOverlay):
// подтверждение прямо на месте кнопки, потом стирается всё про тест — итог,
// история, прогресс. Состояние, тексты и порядок «сервер → localStorage» —
// shared/src/hooks/ysqDataDelete.ts (раньше мини-апп чистил localStorage до
// запроса и ответ не ждал). Пара на сайте —
// webapp/src/components/settingsSheet/YsqDataDeleteButton.tsx.
const label = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(var(--fg-rgb),0.8)',
  marginBottom: 10,
} as const;

export function YsqDataDelete({ onDeleted }: { onDeleted: () => void }) {
  const copy = buildYsqDataDeleteCopy(useTr());
  const del = useYsqDataDelete(api, onDeleted);

  if (!del.confirming) {
    return (
      <div className="u-mb12">
        <div style={label}>Удалить данные теста</div>
        <button
          onClick={del.ask}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '13px 0',
            borderRadius: 'var(--r-12)',
            border:
              '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
            background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
            color: 'var(--accent-red)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {copy.button}
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={copy.title}
      className="u-mb12"
      style={{
        background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
        borderRadius: 'var(--r-12)',
        padding: '14px 16px',
      }}
    >
      <div style={{ ...label, color: 'var(--text)', fontSize: 15 }}>
        {copy.title}
      </div>
      <div className="u-sub13-lh16" style={{ marginBottom: 12 }}>
        {copy.message}
      </div>
      {del.failed && (
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
        busy={del.busy}
        busyLabel={copy.busy}
        onConfirm={() => void del.confirm()}
        onCancel={del.cancel}
      />
    </div>
  );
}
