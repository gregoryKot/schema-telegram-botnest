// «Стоит уделить внимание» в истории (вид «День» и «Неделя»): лист бумаги потребности, которая
// держится низкой, с её знаком — а не белая карточка с одним текстом. Текст несёт экран.
import type { ReactNode } from 'react';
import type { Need } from '../../types';
import type { NeedId } from '../../../../shared/src/needs/types';
import { NeedArt } from '../art/NeedArt';
import { NEED_HUE, hueStyle } from '../../lib/tone';

export function AttentionCard({ need, children }: { need: Need; children: ReactNode }) {
  return (
    <div className="pp-paper sd-low" style={hueStyle(NEED_HUE[need.id as NeedId])}>
      <span className="sd-low-sign" aria-hidden="true"><NeedArt id={need.id} size="row" /></span>
      <div className="sd-low-body">{children}</div>
    </div>
  );
}
