interface Props {
  saving: boolean;
  error: string;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  /** Ввод ещё не годится (дата без времени, будущий день): «Сохранить» недоступна, подсказка — на месте ошибки. */
  hint?: string | null;
}

// «Сохранить / Отмена» и ошибка формы правки в строках блока «Встречи» сайдбара «Обзора» —
// следующая сессия, начало терапии, дни встреч (#906, b30): одна механика на три строки. Тёмной
// акцентной плитки больше нет (b30) — «Сохранить» везде primary; ошибка — tk-error, подсказка к
// вводу — тихо (ds-sub): она не сбой.
export function EditFormActions({ saving, error, onSave, onCancel, hint = null }: Props) {
  const message = hint ?? error;
  return (
    <>
      <div className="tk-edit-actions">
        <button className="ds-btn ds-btn--sm" disabled={saving || hint !== null} aria-busy={saving || undefined} onClick={() => void onSave()}>
          {saving ? '...' : 'Сохранить'}
        </button>
        <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onCancel}>Отмена</button>
      </div>
      {message && <div role="alert" className={hint !== null ? 'ds-sub' : 'tk-error'}>{message}</div>}
    </>
  );
}
