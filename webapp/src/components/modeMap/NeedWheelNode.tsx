import type { CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NeedsWheel } from '../../../../shared/src/components/NeedsWheel';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { NEED_ORDER, getNeedData } from '../../needData';
import { needDataColor } from '../needDataColor';
import { useNodeActions } from '../modeMapActions';
import { NodeTools } from './nodeParts';
import type { ModeNodeData } from './nodeStyle';
import { PERIODS, WHEEL_PX, HEADER_H, WHEEL_NEED_EVENT, averageLabel, needHandle, pctLabel, ratingsOf, sectorPoint, wheelPeriod } from './needWheel';
import '../../styles/sheet-diary.css'; // классы колеса nw-* (history.css подключается только через него)

const NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения
const NEEDS = NEED_ORDER.map((id) => ({ id, emoji: '', title: NAMES[id].name, chartLabel: NAMES[id].name }));

// Ручка сектора: линия ✗/✓ подходит к своей потребности. Стоит на 0,6 радиуса —
// при протяжке линии холст подхватывает ближайшую ручку (connectionRadius), то есть
// сектор, над которым отпустили. Видна при наведении, как ручки других фигур.
const handleStyle = (id: string): CSSProperties => {
  const p = sectorPoint(id, 0.6);
  return { left: p.x, top: p.y, width: 22, height: 22, background: 'transparent', border: 'none', transform: 'translate(-50%, -50%)' };
};

/**
 * Круг потребностей — колесо из пяти секторов (общий NeedsWheel, как колесо дня и
 * «Колесо детства»): сектор заполнен на столько, насколько потребность
 * удовлетворялась в выбранный период; контур поверх — детство для сравнения.
 * Подписи и проценты — легендой под колесом.
 */
export function NeedWheelNode({ id, data, selected }: { id: string; data: ModeNodeData; selected?: boolean }) {
  const actions = useNodeActions();
  const w = data.wheel;
  const period = wheelPeriod(w);
  const ratings = ratingsOf(w, period);
  const childhood = w?.compare && period !== 'child' ? ratingsOf(w, 'child') : {};
  const label = PERIODS.find((p) => p.id === period)!;
  const focusNeed = (needId: string) => {
    actions?.edit(id);
    setTimeout(() => window.dispatchEvent(new CustomEvent(WHEEL_NEED_EVENT, { detail: needId })), 40);
  };
  return (
    <div className={`mm2-wheel${selected ? ' is-selected' : ''}`} style={{ '--h': ENTITY_LOOK.tracker.hue, width: WHEEL_PX } as CSSProperties}>
      <NodeTools id={id} selected={selected} data={data} />
      {NEED_ORDER.map((n) => (
        <span key={n}>
          <Handle type="target" position={Position.Top} id={needHandle(n)} className="mm-handle" style={handleStyle(n)} />
          <Handle type="source" position={Position.Top} id={needHandle(n)} className="mm-handle" style={handleStyle(n)} />
        </span>
      ))}
      <div className="mm2-wheel-head" style={{ height: HEADER_H }}>
        <span className="mm2-wheel-title">{data.label}</span>
      </div>
      <NeedsWheel needs={NEEDS} ratings={ratings} childhoodRatings={childhood} ink={needDataColor}
        onClickNeed={(n) => focusNeed(n.id)} center={{ label: label.center, value: averageLabel(ratings) }} />
      <div className="mm2-wheel-legend">
        {NEEDS.map((n) => (
          <div key={n.id} data-need={n.id}>
            <IdentityDot color={needDataColor(n.id)} size={8} />
            <span className="mm2-wheel-name">{n.title}</span>
            <b>{pctLabel(ratings[n.id])}</b>
          </div>
        ))}
      </div>
      {w?.compare && period !== 'child' && <div className="mm2-wheel-note">контур — детство</div>}
    </div>
  );
}
