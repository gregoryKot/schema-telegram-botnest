interface Props {
  saving: boolean;
  error: string;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  /** Форма на акцентной карточке (ds-card--accent): primary-кнопка слилась бы с заливкой. */
  onAccent?: boolean;
  /** Ввод ещё не годится (дата без времени, будущий день): «Сохранить» недоступна, подсказка — на месте ошибки. */
  hint?: string | null;
}

// «Сохранить / Отмена» и ошибка формы правки в карточках сайдбара «Обзора» —
// следующая сессия, начало терапии, дни встреч (#906): одна механика на три
// карточки. На акцентной карточке «Сохранить» — secondary, ошибка — ds-sub
// (светлая через .ds-card--accent .ds-sub в cabinet.css).
export function EditFormActions({ saving, error, onSave, onCancel, onAccent = false, hint = null }: Props) {
  const message = hint ?? error;
  return (
    <>
      <div className="tk-edit-actions">
        <button className={onAccent ? 'ds-btn ds-btn--secondary ds-btn--sm' : 'ds-btn ds-btn--sm'} disabled={saving || hint !== null} onClick={() => void onSave()}>
          {saving ? '...' : 'Сохранить'}
        </button>
        <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onCancel}>Отмена</button>
      </div>
      {message && <div role="alert" className={onAccent ? 'ds-sub' : 'tk-error'}>{message}</div>}
    </>
  );
}
