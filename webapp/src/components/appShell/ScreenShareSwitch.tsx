import { useId } from 'react';
import { api } from '../../api';
import { setScreenShare } from './screenShareMode';

// Тумблер «Показ экрана» над списком клиентов в сайдбаре кабинета (screenShareMode).
// Весь ряд — label тумблера, как CustomizeRow: тап по тексту тоже переключает. Подпись
// до первого нажатия говорит, что произойдёт, после — что имена уже скрыты.
// Тумблер — тот же .ds-switch, что в настройках; его зона нажатия 44×44 задаёт cabinet.css.
export function ScreenShareSwitch({ on }: { on: boolean }) {
  const id = useId();
  const toggle = () => {
    if (!on) api.trackEvent('cabinet_screen_share_on');
    setScreenShare(!on);
  };
  return (
    <label htmlFor={id} className="sb-share">
      <span className="sb-share-text">
        <span className="sb-share-title">Показ экрана</span>
        <span className="sb-share-sub">{on ? 'Имена клиентов скрыты' : 'Скрыть имена клиентов'}</span>
      </span>
      <button id={id} type="button" role="switch" aria-checked={on} aria-label="Показ экрана"
              className="ds-switch" onClick={toggle}>
        <span className="ds-switch-knob" />
      </button>
    </label>
  );
}
