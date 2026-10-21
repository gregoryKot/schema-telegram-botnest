// «Что поможет» — блок между карточкой и записями: голос Здорового Взрослого
// (режим) или совет и потребность (схема) плюс три быстрые практики, которые
// открывают тот же QuickPracticeSheet, что и «Здесь и сейчас». Контент
// собирает shared/pattern/patternHelpContent (один источник с мини-аппом).
import { useState } from 'react';
import { QuickPracticeSheet } from '../practice/QuickPracticeSheet';
import { useTr, useAddressForm } from '../../utils/addressForm';
import { resolveModeHelp, resolveSchemaHelp } from '../../../../shared/src/pattern/patternHelpContent';
import {
  QUICK_PRACTICE_IDS,
  buildQuickPractice,
  type QuickPracticeId,
} from '../../../../shared/src/practices/quickPractices';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

interface Props {
  kind: MyCardsKind;
  id: string;
}

export function PatternHelpSection({ kind, id }: Props) {
  const tr = useTr();
  const form = useAddressForm();
  const [active, setActive] = useState<QuickPracticeId | null>(null);

  const mode = kind === 'mode' ? resolveModeHelp(id) : null;
  const schema = kind === 'schema' ? resolveSchemaHelp(id, form) : null;
  const needText =
    mode?.needText ??
    (schema?.needName && schema.needLine ? `${schema.needName} — ${schema.needLine}` : null);

  return (
    <section className="ps-block">
      <div className="ds-label">Что поможет</div>
      {mode && (
        <div className="ps-adult">
          <div className="ps-adult-title">Здоровый Взрослый отвечает</div>
          <div className="ps-adult-text">{mode.adultText}</div>
        </div>
      )}
      {schema?.tip && <p className="ps-tip">{schema.tip}</p>}
      {needText && (
        <div>
          <div className="ps-field-label">Что на самом деле нужно</div>
          <p className="ps-tip">{needText}</p>
        </div>
      )}
      <div className="ps-chips" role="group" aria-label="Быстрые практики">
        {QUICK_PRACTICE_IDS.map((pid) => {
          const p = buildQuickPractice(pid, tr);
          return (
            <button key={pid} className="ps-pill" onClick={() => setActive(pid)}>
              <span aria-hidden>{p.emoji}</span> {p.title}
            </button>
          );
        })}
      </div>
      {active && <QuickPracticeSheet id={active} onClose={() => setActive(null)} />}
    </section>
  );
}
