import { useTr } from '../../utils/addressForm';

// Пустой холст любой графической карты: что сделать первым. Холст бывает только на
// компьютере и планшете (на телефоне вкладка показывает ModeMapTab без
// холста), поэтому подсказка — про панель слева. Вид — общий .ds-empty (#906).
export function CanvasEmpty() {
  const tr = useTr();
  return (
    <div className="mm2-canvas-empty">
      <p className="ds-empty">Карта пуста</p>
      <p className="ds-empty">
        {tr('Кликай по режиму в панели слева или перетащи его на холст', 'Кликайте по режиму в панели слева или перетащите его на холст')}
      </p>
    </div>
  );
}
