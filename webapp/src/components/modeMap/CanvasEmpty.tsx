import { MMIcon } from '../modeMapIcons';
import { useTr } from '../../utils/addressForm';
import { useIsMobile } from '../useIsMobile';

// Пустой холст карты режимов: что сделать первым. На телефоне палитра не
// стоит колонкой слева, а открывается кнопкой «›» в левом верхнем углу
// холста (ModeMapEditor), и перетаскивать из неё на холст нечем — подсказка
// говорит про кнопку, а не про «панель слева».
export function CanvasEmpty() {
  const tr = useTr();
  const mobile = useIsMobile();
  return (
    <div className="mm2-canvas-empty">
      <div className="mm2-empty-ico"><MMIcon name="map" size={26} /></div>
      <div className="mm2-empty-title">Карта режимов пуста</div>
      <div className="mm2-empty-sub">
        {mobile
          ? tr('Открой список режимов кнопкой › слева вверху и нажми на режим', 'Откройте список режимов кнопкой › слева вверху и нажмите на режим')
          : tr('Кликай по режиму в панели слева или перетащи его на холст', 'Кликайте по режиму в панели слева или перетащите его на холст')}
      </div>
    </div>
  );
}
