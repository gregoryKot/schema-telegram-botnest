import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { MODE_MAP_NODE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { needPct, needRatings, type ConceptNeedLink, type NeedPeriod } from '../../../../shared/src/therapy/conceptGraph/needLinks';
import type { NeedId } from '../../../../shared/src/needs/types';
import { getNeedData } from '../../needData';
import { NEED_HUE } from '../../lib/tone';
import { needDataColor } from '../needDataColor';
import { CWTrack } from '../exercises/childhoodWheel/CWTrack';
import { WheelConceptLine } from './WheelLinks';
import { PERIODS } from './needWheel';
import { noteOf, setNote, setRating } from './wheelData';

const NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения

/**
 * Строка потребности в панели колеса за выбранный период: название, процент, «сбросить» и
 * ползунок 0–10 упражнения «Колесо детства». Раскрытая — что о потребности сказано в
 * концептуализации и поле листа за этот период. Каждая правка отдаёт колесо целиком.
 */
export function WheelNeedRow({ needId, period, links, open, onToggle, onSave }: {
  needId: NeedId; period: NeedPeriod; links: ConceptNeedLink[]; open: boolean;
  onToggle: () => void; onSave: (links: ConceptNeedLink[]) => void;
}) {
  const p = PERIODS.find((x) => x.id === period)!;
  const v = needRatings(links, period)[needId];
  const name = NAMES[needId].name;
  return (
    <div className={`mm2-wp${open ? ' is-open' : ''}`} data-need={needId}>
      <div className="mm2-wp-head">
        <button type="button" className="mm2-wp-name" aria-expanded={open} onClick={onToggle}>
          <IdentityDot color={needDataColor(needId)} size={8} /> {name}
        </button>
        <b>{needPct(v)}</b>
        {v !== undefined && <button type="button" className="ds-link" onClick={() => onSave(setRating(links, period, needId, undefined))}>сбросить</button>}
      </div>
      <CWTrack value={v} onChange={nv => onSave(setRating(links, period, needId, nv))} hue={NEED_HUE[needId]} label={`${name}: ${p.label}`} />
      {open && (
        <>
          <WheelConceptLine needId={needId} />
          <label className="ds-label" htmlFor={`mm-wheel-note-${needId}`}>{p.note}</label>
          <textarea id={`mm-wheel-note-${needId}`} className="ds-textarea" rows={3} maxLength={MODE_MAP_NODE_TEXT_MAX}
            value={noteOf(links, period, needId)} onChange={e => onSave(setNote(links, period, needId, e.target.value))} />
        </>
      )}
    </div>
  );
}
