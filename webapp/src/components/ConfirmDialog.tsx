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
      <h2 className="ds-h2 sk-dialog-title">{title}</h2>
      <div className="sk-dialog-text">{message}</div>
      {error && (
        <div role="alert" className="sk-error sk-dialog-error">
          {error}
        </div>
      )}
      <div className="sk-dialog-actions">
        <button className="ds-btn ds-btn--secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          className={danger ? 'ds-btn sk-btn-danger' : 'ds-btn'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
