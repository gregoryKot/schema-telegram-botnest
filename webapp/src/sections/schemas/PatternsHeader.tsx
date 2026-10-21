import { CustomizeGear, CustomizeLink } from '../../components/customize/CustomizeGear';

/**
 * Шапка «Паттернов». Десктоп: надпись, крупный заголовок, подзаголовок, справа
 * «Настроить экран» и «Библиотека». Телефон (как в мини-аппе): «Паттерны» и подпись
 * слева, шестерёнка настройки экрана и «Библиотека» справа в той же строке.
 */
export function PatternsHeader({ mobile, onOpenLibrary, onCustomize }: { mobile: boolean; onOpenLibrary: () => void; onCustomize: () => void }) {
  return (
    <div className="ds-head-row cs-head">
      <div className="cs-head-text">
        {!mobile && <div className="ds-eyebrow">Схема-терапия</div>}
        <h1 className="ds-h1">{mobile ? 'Паттерны' : <>Мои <i>паттерны</i></>}</h1>
        <div className="ds-sub cs-head-sub">{mobile ? 'Привычные реакции родом из детства' : 'Схемы, режимы, потребности'}</div>
      </div>
      {mobile ? <CustomizeGear label="Настроить экран" onClick={onCustomize} /> : <CustomizeLink onClick={onCustomize} />}
      <button onClick={onOpenLibrary} className="ds-btn ds-btn--secondary">Библиотека</button>
    </div>
  );
}
