// Скелетон истории потребностей — по форме экрана (правило «скелетоны по форме, не спиннеры»):
// лента из семи листков-дней, переключатель вида, лист дня с силуэтом колеса (те же пять секторов
// и центральный круг того же диаметра — общая геометрия needsWheelGeometry, а не знак Wheel: звезда
// на месте круглого колеса прыгала при загрузке) и строки потребностей с местом знака — та же сетка,
// что у вида «День» (history.css): при появлении данных экран не сдвигается.
import { Skeleton } from './Skeleton';
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { CENTER_R, CX, CY, H, W, wheelSectors } from '../../../shared/src/components/needsWheelGeometry';
import { hueStyle } from '../lib/tone';

const FIVE = [0, 1, 2, 3, 4];

export function HistorySheetSkeleton() {
  return (
    <div className="sd-history" aria-hidden>
      <div className="sd-days">{[...FIVE, 5, 6].map(i => <span key={i} className="sd-day-slot"><Skeleton height={72} radius={14} /></span>)}</div>
      <div className="sd-toolbar"><span className="sd-seg-slot"><Skeleton height={44} radius={20} /></span></div>
      <div className="sd-day-grid">
        <div className="sd-day-side"><div className="pp-paper sd-wheel sd-wheel--skel" style={hueStyle(ENTITY_LOOK.tracker.hue)}>
          <svg viewBox={`0 0 ${W} ${H}`}>
            {wheelSectors(FIVE.length).map((d, i) => <path key={i} d={d} />)}
            <circle className="sd-wheel-skel-center" cx={CX} cy={CY} r={CENTER_R} />
          </svg>
        </div></div>
        <div className="ds-card ds-card--flush">
          {FIVE.map(i => (
            <div key={i} className="ds-list-row sd-need-row"><Skeleton width={44} height={24} /><Skeleton width="45%" height={12} /><span /><Skeleton width={22} height={22} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
