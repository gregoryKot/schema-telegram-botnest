import type { CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { needPct } from '../../../../shared/src/therapy/conceptGraph/needLinks';
import { NEED_ORDER } from '../../needData';
import { needDataColor } from '../needDataColor';
import { WHEEL_NEEDS, labelSide, needHandle, sectorPoint } from './needWheel';

// Части узла колеса потребностей вокруг самого рисунка: ручки секторов для линий ✗/✓ и
// подписи секторов (вынесено из NeedWheelNode.tsx, правило №10).


// Ручка сектора стоит на 0,6 радиуса: при протяжке линии холст подхватывает ближайшую
// ручку (connectionRadius), то есть сектор, над которым отпустили. Видна при наведении.
const handleStyle = (id: string): CSSProperties => {
  const p = sectorPoint(id, 0.6);
  return { left: p.x, top: p.y, width: 22, height: 22, background: 'transparent', border: 'none', transform: 'translate(-50%, -50%)' };
};

export function SectorHandles() {
  return (
    <>
      {NEED_ORDER.map((n) => (
        <span key={n}>
          <Handle type="target" position={Position.Top} id={needHandle(n)} className="mm-handle" style={handleStyle(n)} />
          <Handle type="source" position={Position.Top} id={needHandle(n)} className="mm-handle" style={handleStyle(n)} />
        </span>
      ))}
    </>
  );
}

/** Подпись у сектора: над колесом (верхний) или сбоку от края сектора, текстом наружу. */
const labelStyle = (id: string): CSSProperties => {
  const side = labelSide(id);
  const p = sectorPoint(id, side === 'top' ? 1.04 : 1.08);
  return { left: p.x, top: p.y, transform: side === 'top' ? 'translate(-50%, -100%)' : side === 'right' ? 'translate(0, -50%)' : 'translate(-100%, -50%)' };
};

/** Название и процент у каждого сектора (владелец 2026-11-12: «подписи не только в легенде, но и на колесе»); клик открывает потребность в панели. */
export function SectorLabels({ ratings, onPick }: { ratings: Record<string, number>; onPick: (needId: string) => void }) {
  return (
    <>
      {WHEEL_NEEDS.map((n) => (
        <button key={n.id} type="button" data-need={n.id} onClick={() => onPick(n.id)}
          className={`mm2-wheel-lab nodrag is-${labelSide(n.id)}`} style={labelStyle(n.id)}>
          <span className="mm2-wheel-name"><IdentityDot color={needDataColor(n.id)} size={8} /> {n.title}</span>
          <b>{needPct(ratings[n.id])}</b>
        </button>
      ))}
    </>
  );
}
