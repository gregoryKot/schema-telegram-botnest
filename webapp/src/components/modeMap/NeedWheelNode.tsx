import type { CSSProperties } from 'react';
import { NeedsWheel } from '../../../../shared/src/components/NeedsWheel';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { needRatings } from '../../../../shared/src/therapy/conceptGraph/needLinks';
import { needDataColor } from '../needDataColor';
import { useNodeActions } from '../modeMapActions';
import { NodeTools } from './nodeParts';
import type { ModeNodeData } from './nodeStyle';
import { PERIODS, WHEEL_NEEDS, WHEEL_NODE_W, HEADER_H, WHEEL_NEED_EVENT, averageLabel, wheelPeriod } from './needWheel';
import { SectorHandles, SectorLabels } from './WheelNodeParts';
import { useWheelLegacyMove } from './useWheelLegacyMove';
import { useWheel } from './wheelContext';
import '../../styles/sheet-diary.css'; // классы колеса nw-* (history.css подключается только через него)

/**
 * Круг потребностей — колесо из пяти секторов (общий NeedsWheel, как колесо дня и
 * «Колесо детства»): сектор заполнен на столько, насколько потребность
 * удовлетворялась в выбранный период; контур поверх — детство для сравнения.
 * Название и процент стоят у своего сектора. Оценки — из концептуализации клиента
 * (useWheel): одно колесо на клиента; в карте узел хранит только вид. Без колеса
 * клиента (карта у клиента, загрузка) — названия и «—».
 */
export function NeedWheelNode({ id, data, selected }: { id: string; data: ModeNodeData; selected?: boolean }) {
  const actions = useNodeActions();
  const wheel = useWheel();
  const view = data.wheel;
  const period = wheelPeriod(view);
  const links = wheel?.links ?? [];
  const ratings = needRatings(links, period);
  const compare = !!view?.compare && period !== 'child';
  const label = PERIODS.find((p) => p.id === period)!;
  useWheelLegacyMove(id, view);

  const focusNeed = (needId: string) => {
    actions?.edit(id);
    setTimeout(() => window.dispatchEvent(new CustomEvent(WHEEL_NEED_EVENT, { detail: needId })), 40);
  };
  return (
    <div className={`mm2-wheel${selected ? ' is-selected' : ''}`} style={{ '--h': ENTITY_LOOK.tracker.hue, width: WHEEL_NODE_W } as CSSProperties}>
      <NodeTools id={id} selected={selected} data={data} />
      <SectorHandles />
      <div className="mm2-wheel-head" style={{ height: HEADER_H }}>
        <span className="mm2-wheel-title">{data.label}</span>
      </div>
      <div className="mm2-wheel-art">
        <NeedsWheel needs={WHEEL_NEEDS} ratings={ratings} childhoodRatings={compare ? needRatings(links, 'child') : {}} ink={needDataColor}
          onClickNeed={(n) => focusNeed(n.id)} center={{ label: label.center, value: averageLabel(ratings) }} />
      </div>
      <SectorLabels ratings={ratings} onPick={focusNeed} />
      {compare && <div className="mm2-wheel-note">контур — детство</div>}
      {wheel?.failed && <div className="mm2-wheel-note" role="status">Концептуализация не загрузилась: процентов пока нет</div>}
    </div>
  );
}
