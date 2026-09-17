import { useEffect } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

// Ж4 (аудит 2026-08): единый стилизованный диалог подтверждения — раньше три
// места (отвязка провайдера в AccountPage, удаление карты режимов в
// ModeMapSelector, удаление клиента в useClientDetail) звали нативный
// `window.confirm()`, который не следует теме и не озвучивается как диалог
// скринридером, рядом с уже полноценным DeleteAccountDialog. Общий примитив,
// а не третья копия одной механики (правило «одна механика — один
// компонент») — DeleteAccountDialog переведён на него же.
//
// Доступность — тот же `useDialogA11y` (К4, волна B): role="dialog",
// aria-modal, фокус-трап, возврат фокуса. Escape закрывает (если не `busy`).
export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Отмена',
  danger = true,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogA11y = useDialogA11y();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => !busy && onCancel()}
    >
      {/* onClick/onKeyDown здесь — не интерактив, а stopPropagation (не дать
          клику/Enter-Space внутри диалога всплыть до onCancel на бэкдропе,
          тот же паттерн, что в NeedAdviceModal.tsx). role="dialog" не входит
          в список «интерактивных» ролей jsx-a11y, поэтому правило ложно
          срабатывает на паре onClick+role. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...dialogA11y}
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-12)',
          padding: '28px 28px 32px',
          width: '100%',
          maxWidth: 420,
          border: '1px solid rgba(var(--fg-rgb),0.08)',
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {message}
        </div>
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 14,
              color: 'var(--c-rose)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 'var(--r-14)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 'var(--r-14)',
              border: 'none',
              background: danger ? 'var(--c-rose)' : 'var(--accent)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
