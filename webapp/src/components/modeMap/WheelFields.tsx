import { useEffect, useState } from 'react';
import type { ModeMapNode, UserId } from '../../api';
import { NEED_ORDER, getNeedData } from '../../needData';
import type { NeedId } from '../../../../shared/src/needs/types';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { MODE_MAP_NODE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { useTr } from '../../utils/addressForm';
import { NEED_HUE } from '../../lib/tone';
import { needDataColor } from '../needDataColor';
import { CWTrack } from '../exercises/childhoodWheel/CWTrack';
import { SegRow } from './EditorParts';
import { WheelChildhood, WheelConceptLine } from './WheelLinks';
import { PERIODS, WHEEL_NEED_EVENT, noteOf, pctLabel, ratingsOf, setNote, setRating, wheelPeriod, type WheelData } from './needWheel';
import '../../styles/sheet-exercises.css'; // ползунок «Колеса детства» (ex-wheel.css подключается только через него)

type Data = ModeMapNode['data'];
const NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения

/**
 * Панель колеса потребностей (лист Farrell & Shaw): какой период на колесе и контур
 * детства поверх, «Колесо детства» клиента, потребность (чипы или клик по сектору) и
 * по ней три периода — процент тем же ползунком 0–10, что в упражнении, и текст листа.
 */
export function WheelFields({ data, patchData, clientId }: { data: Data; patchData: (d: Partial<Data>) => void; clientId?: UserId }) {
  const tr = useTr();
  const w: WheelData = data.wheel ?? {};
  const period = wheelPeriod(w);
  const [need, setNeed] = useState<NeedId>(NEED_ORDER[0]);
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if ((NEED_ORDER as readonly string[]).includes(id)) setNeed(id as NeedId);
    };
    window.addEventListener(WHEEL_NEED_EVENT, h);
    return () => window.removeEventListener(WHEEL_NEED_EVENT, h);
  }, []);
  const save = (next: WheelData) => patchData({ wheel: next });
  const shown = ratingsOf(w, period);
  return (
    <>
      <div className="mm2-hint">
        <div className="ds-label">Колесо потребностей</div>
        <p className="mm2-hint-p">Пять базовых потребностей по листу Фаррелл и Шоу: насколько каждая удовлетворялась в детстве, в 11–17 лет и сейчас.</p>
        <p className="mm2-hint-p">{tr('Выбери потребность или нажми на её сектор и поставь процент за каждый период.',
          'Выберите потребность или нажмите на её сектор и поставьте процент за каждый период.')}</p>
      </div>

      <div className="ds-label">На колесе</div>
      <SegRow items={PERIODS.map(p => ({ key: p.id, label: p.label, active: period === p.id, onPick: () => save({ ...w, period: p.id }) }))} />
      <label className="mm2-check">
        <input type="checkbox" checked={!!w.compare && period !== 'child'} disabled={period === 'child'}
          onChange={e => save({ ...w, compare: e.target.checked || undefined })} />
        Контур детства поверх
      </label>

      <WheelChildhood clientId={clientId} wheel={w} onApply={save} />

      <div className="ds-label" id="mm-wheel-need">Потребность</div>
      <div className="mm2-chips mm2-dot-chips" role="group" aria-labelledby="mm-wheel-need">
        {NEED_ORDER.map(id => (
          <button key={id} type="button" onClick={() => setNeed(id)} aria-pressed={need === id}
            className={`mm2-chip is-sm${need === id ? ' is-active' : ''}`}>
            <IdentityDot color={needDataColor(id)} size={7} /> {NAMES[id].name} <span className="mm2-chip-val">{pctLabel(shown[id])}</span>
          </button>
        ))}
      </div>
      <WheelConceptLine needId={need} />

      {PERIODS.map(p => {
        const v = ratingsOf(w, p.id)[need];
        return (
          <div key={p.id} className="mm2-wp" data-period={p.id}>
            <div className="mm2-wp-head">
              <span>{p.label}</span>
              <b>{pctLabel(v)}</b>
              {v !== undefined && (
                <button type="button" className="ds-link" onClick={() => save(setRating(w, p.id, need, undefined))}>сбросить</button>
              )}
            </div>
            <CWTrack value={v} onChange={nv => save(setRating(w, p.id, need, nv))} hue={NEED_HUE[need]} label={`${NAMES[need].name}: ${p.label}`} />
            <label className="ds-label" htmlFor={`mm-wheel-note-${p.id}`}>{p.note}</label>
            <textarea id={`mm-wheel-note-${p.id}`} className="ds-textarea" rows={2} maxLength={MODE_MAP_NODE_TEXT_MAX}
              value={noteOf(w, p.id, need)} onChange={e => save(setNote(w, p.id, need, e.target.value))} />
          </div>
        );
      })}
    </>
  );
}
