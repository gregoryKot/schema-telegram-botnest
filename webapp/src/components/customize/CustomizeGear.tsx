import { GearIcon } from '../../../../shared/src/components/GearIcon';
import '../../styles/customize-head.css';

/** Шестерёнка в шапке экрана («Профиль», «Паттерны») — всегда общие «Настройки» (#906): та же
 *  иконочная кнопка ds-btn--icon, что и у остальных действий шапки; подпись зашита, чтобы
 *  значок нигде не значил «настроить экран». */
export function SettingsGear({ onClick }: { onClick: () => void }) {
  return <button type="button" className="ds-btn ds-btn--icon" aria-label="Настройки" onClick={onClick}><GearIcon size={20} /></button>;
}

/** Ссылка «Настроить экран» в шапке (любая ширина); label — если лист про часть экрана. */
export function CustomizeLink({ onClick, label = 'Настроить экран' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="ds-link cz-link" onClick={onClick}>{label}</button>;
}
