/**
 * Шапка «Паттернов». Десктоп: надпись, крупный заголовок, подзаголовок.
 * Телефон (как в мини-аппе): «Паттерны» и подпись слева, «Библиотека» справа в той же строке.
 */
export function PatternsHeader({ mobile, onOpenLibrary }: { mobile: boolean; onOpenLibrary: () => void }) {
  return (
    <div className="ds-head-row cs-head">
      <div className="cs-head-text">
        {!mobile && <div className="ds-eyebrow">Схема-терапия</div>}
        <h1 className="ds-h1">{mobile ? 'Паттерны' : <>Мои <i>паттерны</i></>}</h1>
        <div className="ds-sub cs-head-sub">{mobile ? 'Привычные реакции родом из детства' : 'Схемы, режимы, потребности'}</div>
      </div>
      <button onClick={onOpenLibrary} className="ds-btn ds-btn--secondary">Библиотека</button>
    </div>
  );
}
