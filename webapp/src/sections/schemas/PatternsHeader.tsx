import { SettingsGear, CustomizeLink } from '../../components/customize/CustomizeGear';
interface Props { mobile: boolean; onOpenLibrary: () => void; onCustomize: () => void; onOpenSettings?: () => void }

// Шапка «Паттернов» — один состав на любой ширине (#906); на телефоне «Настроить экран» и шестерёнка — в строке надписи (css).
export function PatternsHeader({ mobile, onOpenLibrary, onCustomize, onOpenSettings }: Props) {
  return (
    <div className="ds-head-row cs-head">
      <div className="cs-head-text">
        <div className="ds-eyebrow">Схема-терапия</div>
        <h1 className="ds-h1">{mobile ? 'Паттерны' : <>Мои <i>паттерны</i></>}</h1>
        <div className="ds-sub cs-head-sub">{mobile ? 'Привычные реакции родом из детства' : 'Схемы, режимы, потребности'}</div>
      </div>
      <div className="cs-head-actions">
        <div className="cs-head-tools"><CustomizeLink onClick={onCustomize} />{onOpenSettings && <SettingsGear onClick={onOpenSettings} />}</div>
        <button type="button" onClick={onOpenLibrary} className="ds-btn ds-btn--secondary cs-head-lib">Библиотека</button>
      </div>
    </div>
  );
}
