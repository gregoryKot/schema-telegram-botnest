import { GearIcon } from '../../../../shared/src/components/GearIcon';
import '../../styles/customize-head.css';

/** Шестерёнка в шапке экрана (телефон): тот же рисунок, что на «Сегодня». */
export function CustomizeGear({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cz-gear" aria-label={label} onClick={onClick}>
      <GearIcon />
    </button>
  );
}

/** Ссылка «Настроить экран» в шапке (десктоп); label — если лист про часть экрана. */
export function CustomizeLink({ onClick, label = 'Настроить экран' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="ds-link cz-link" onClick={onClick}>
      {label}
    </button>
  );
}
