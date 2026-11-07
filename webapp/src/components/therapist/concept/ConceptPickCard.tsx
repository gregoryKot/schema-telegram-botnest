import type { ReactNode } from 'react';
import { useEditToggle } from './useEditToggle';

// Карточка выбора вида «Поля»: показаны только выбранные, полный перечень
// (все схемы / все режимы) — по кнопке «Изменить». Одна механика на обе
// карточки («Актуальные схемы», «Карта режимов»).
export function ConceptPickCard({
  title, sub, hasSelection, selected, editor, children,
}: {
  title: string;
  sub: string;
  hasSelection: boolean;
  /** Выбранное, только показать. */
  selected: ReactNode;
  /** Полный выбор. */
  editor: ReactNode;
  /** Остаётся под выбранным в обоих видах (схемы за режимами). */
  children?: ReactNode;
}) {
  const { editing, canToggle, toggle } = useEditToggle(hasSelection);
  return (
    <section className="ds-card">
      <div className="ds-head-row tcp-pick-head">
        <div className="tcp-pick-title">
          <h3 className="ds-h3">{title}</h3>
          <span className="ds-sub">{sub}</span>
        </div>
        {canToggle && (
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            aria-expanded={editing}
            aria-label={`${editing ? 'Готово' : 'Изменить'}: ${title}`}
            onClick={toggle}
          >
            {editing ? 'Готово' : 'Изменить'}
          </button>
        )}
      </div>
      {editing ? editor : selected}
      {children}
    </section>
  );
}
