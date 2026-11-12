import { useState, type ReactNode } from 'react';

// Карточка выбора вида «Поля»: в покое — заголовок, счётчик и только выбранное; полный перечень
// (все схемы / все режимы) раскрывает «Изменить» — и когда ничего не выбрано тоже: до первого поля
// не стоят 20 схем и ~45 режимов чипами (редизайн 2026-11, b33). Открытый выбор сам не
// сворачивается: сняли последний чип — перечень остаётся под пальцем до «Готово».
// Одна механика на обе карточки («Актуальные схемы», «Карта режимов»).
export function ConceptPickCard({
  title, sub, selected, editor, children,
}: {
  title: string;
  sub: string;
  /** Выбранное, только показать. */
  selected: ReactNode;
  /** Полный выбор. */
  editor: ReactNode;
  /** Остаётся под выбранным в обоих видах (схемы за режимами). */
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="ds-card tcp-pick">
      <div className="ds-head-row tcp-pick-head">
        <div className="tcp-pick-title">
          <h3 className="ds-h3">{title}</h3>
          <span className="ds-sub">{sub}</span>
        </div>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          aria-expanded={editing}
          aria-label={`${editing ? 'Готово' : 'Изменить'}: ${title}`}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Готово' : 'Изменить'}
        </button>
      </div>
      {editing ? editor : selected}
      {children}
    </section>
  );
}
