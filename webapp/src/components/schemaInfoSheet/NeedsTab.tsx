import { useTr } from '../../utils/addressForm';
import { NEED_ORDER } from '../../needData';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { buildNeedsData } from './data';
import { NEEDS_WHAT } from '../../../../shared/src/pattern/patternTerms';

// Вкладка «потребности» справочника схем. Вынесено из SchemaInfoSheet.tsx (правило №10).
export function NeedsTab() {
  const tr = useTr();
  const needs = buildNeedsData(tr);
  return (
    <div className="ss-pane">
      <p className="ss-body">{NEEDS_WHAT}</p>
      {needs.map((n, i) => (
        <div key={n.title} className="ds-card ss-need" style={hueStyle(NEED_HUE[NEED_ORDER[i]])}>
          <div className="ss-need-head">
            <IdentityDot id={NEED_ORDER[i]} size={16} />
            <div>
              <div className="ss-need-title">{n.title}</div>
              <div className="ds-sub">{n.subtitle}</div>
            </div>
          </div>
          <p className="ss-body">{n.desc}</p>
        </div>
      ))}
    </div>
  );
}
