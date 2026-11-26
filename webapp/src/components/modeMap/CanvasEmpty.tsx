import { useTr } from '../../utils/addressForm';
import { PaperEmpty } from '../art/PaperEmpty';
import { Cluster } from '../art/PaperArtSigns';

// Пустой холст любой графической карты: что сделать первым. Холст бывает только на
// компьютере и планшете (на телефоне вкладка показывает ModeMapTab без холста),
// поэтому подсказка — про панель слева; знак — круги режимов из неё (Cluster).
export function CanvasEmpty() {
  const tr = useTr();
  return (
    <div className="mm2-canvas-empty">
      <PaperEmpty art={Cluster} title="Карта пуста">
        {tr('Кликай по режиму в панели слева или перетащи его на холст', 'Кликайте по режиму в панели слева или перетащите его на холст')}
      </PaperEmpty>
    </div>
  );
}
