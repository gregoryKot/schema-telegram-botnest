import { Dialog } from './Dialog';

// Ж4 (аудит 2026-08): единый стилизованный диалог подтверждения — раньше три
// места (отвязка провайдера в AccountPage, удаление карты режимов в
// ModeMapSelector, удаление клиента в useClientDetail) звали нативный
// `window.confirm()`, который не следует теме и не озвучивается как диалог
// скринридером, рядом с уже полноценным DeleteAccountDialog. Общий примитив,
// а не третья копия одной механики (правило «одна механика — один
// компонент») — DeleteAccountDialog переведён на него же.
//
// Оболочка и вид — общий `Dialog` (role="dialog", aria-modal, фокус-трап,
// возврат фокуса, единый editorial-вид с остальными центрированными окнами).
// Escape и клик по фону закрывают, если не `busy`.
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
  return (
    <Dialog
      label={title}
      onClose={busy ? undefined : onCancel}
      closeOnEscape
    >
      <h2 className="dialog-title">{title}</h2>
      <div className="dialog-text">{message}</div>
      {error && (
        <div role="alert" className="dialog-error">
          {error}
        </div>
      )}
      <div className="dialog-actions">
        <button className="btn-outline" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          className={danger ? 'btn-primary btn-primary--danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
