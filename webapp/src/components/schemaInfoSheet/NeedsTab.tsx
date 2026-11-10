import { useTr } from '../../utils/addressForm';
import { NEED_ORDER } from '../../needData';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { NeedArt } from '../art/NeedArt';
import { buildNeedsData } from './data';
import { NEEDS_WHAT } from '../../../../shared/src/pattern/patternTerms';

// Вкладка «потребности» справочника (вынесено из SchemaInfoSheet.tsx, правило №10): лист бумаги
// потребности со знаком NeedArt у названия — как в «Паттернах» и у терапевта, а не цветные точки.
export function NeedsTab() {
  const needs = buildNeedsData(useTr());
  return (
    <div className="ss-pane">
      <p className="ss-body">{NEEDS_WHAT}</p>
      <div className="ss-needs">{needs.map((n, i) => (
        <section key={n.title} className="pp-paper ss-need" style={hueStyle(NEED_HUE[NEED_ORDER[i]])}>
          <div className="ss-need-head">
            <span className="sg-sign" aria-hidden="true"><NeedArt id={NEED_ORDER[i]} size="square" /></span>
            <div><h3 className="ss-need-title">{n.title}</h3><div className="ss-need-sub">{n.subtitle}</div></div>
          </div>
          <p className="ss-body">{n.desc}</p>
        </section>
      ))}</div>
    </div>
  );
}
