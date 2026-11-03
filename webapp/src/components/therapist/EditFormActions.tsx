interface Props {
  saving: boolean;
  error: string;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  /** Форма на акцентной карточке (ds-card--accent): primary-кнопка слилась бы с заливкой. */
  onAccent?: boolean;
}

// «Сохранить / Отмена» и ошибка формы правки в карточках сайдбара «Обзора» —
// следующая сессия, начало терапии, дни встреч (#906): одна механика на три
// карточки. На акцентной карточке «Сохранить» — secondary, ошибка — ds-sub
// (светлая через .ds-card--accent .ds-sub в cabinet.css).
export function EditFormActions({ saving, error, onSave, onCancel, onAccent = false }: Props) {
  return (
    <>
      <div className="tk-edit-actions">
        <button className={onAccent ? 'ds-btn ds-btn--secondary ds-btn--sm' : 'ds-btn ds-btn--sm'} disabled={saving} onClick={() => void onSave()}>
          {saving ? '...' : 'Сохранить'}
        </button>
        <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onCancel}>Отмена</button>
      </div>
      {error && <div role="alert" className={onAccent ? 'ds-sub' : 'tk-error'}>{error}</div>}
    </>
  );
}
