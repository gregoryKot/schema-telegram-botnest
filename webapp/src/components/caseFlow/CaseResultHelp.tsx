// «Что поможет сейчас» на итоге разбора — плитка цветной бумаги дыхания (ENTITY_LOOK.breathing:
// персик + Breath), как квадраты главной: видно, что это вход в практику, а не белая плашка с тенью.
// Тап открывает минуту дыхания поверх итога (QuickPracticeSheet, свой лист со своей записью истории).
import { useState } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { QuickPracticeSheet } from '../practice/QuickPracticeSheet';

/** «4-4-6» не рвётся на дефисе (на 360 строка падала «4- / 4-6»): дефис неразрывный, как в glue. */
const NO_BREAK = (text: string) => text.replace(/-/g, '\u2011');

export function CaseResultHelp() {
  const [breathing, setBreathing] = useState(false);
  const { hue, sign } = ENTITY_LOOK.breathing;
  return (
    <>
      <button type="button" className="pp-paper cq-help" style={hueStyle(hue)} onClick={() => setBreathing(true)}>
        <span className="cq-help-body">
          <span className="ds-label cq-help-label">Что поможет сейчас</span>
          <span className="cq-help-title">{NO_BREAK('Минута дыхания 4-4-6')}</span>
        </span>
        <span className="cq-help-art" aria-hidden="true"><SignArt sign={sign} size="square" /></span>
        <span className="pp-arrow cq-help-arrow" aria-hidden="true">→</span>
      </button>
      {breathing && <QuickPracticeSheet id="breathing" onClose={() => setBreathing(false)} />}
    </>
  );
}
