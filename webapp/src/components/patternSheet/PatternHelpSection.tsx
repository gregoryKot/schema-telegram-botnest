// «Что поможет» — блок между карточкой и записями: голос Здорового Взрослого
// (режим — вставкой мха со знаком Together, HealthyVoice) или совет и потребность
// (схема) плюс три быстрые практики плитками бумаги со знаком практики из
// QUICK_LOOK — того же вида, что у квадратов «Практик» (вместо пилюль с эмодзи
// 🌬🌍🛑, b15); они открывают тот же QuickPracticeSheet, что и «Здесь и сейчас». Контент собирает
// shared/pattern/patternHelpContent (один источник с мини-аппом).
import { useState, type CSSProperties } from 'react';
import { QuickPracticeSheet } from '../practice/QuickPracticeSheet';
import { HealthyVoice } from '../paper/HealthyVoice';
import { SignArt } from '../art/SignArt';
import { useTr, useAddressForm } from '../../utils/addressForm';
import { QUICK_LOOK } from '../practice/quickLook';
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
      <div className="ds-label ps-label">Что поможет</div>
      {mode && <HealthyVoice label="Здоровый Взрослый отвечает" text={mode.adultText} />}
      {schema?.tip && <p className="ps-tip">{schema.tip}</p>}
      {needText && (
        <div className="ps-need">
          <div className="ds-label ps-field-label">Что на самом деле нужно</div>
          <p className="ps-tip">{needText}</p>
        </div>
      )}
      <div className="ps-practices-box"><div className="ps-practices" role="group" aria-label="Быстрые практики">
        {QUICK_PRACTICE_IDS.map((pid) => {
          const p = buildQuickPractice(pid, tr);
          const look = QUICK_LOOK[pid];
          return (
            <button key={pid} type="button" className="pp-paper ps-practice" style={{ '--h': look.hue } as CSSProperties} onClick={() => setActive(pid)}>
              <span className="ps-practice-title">{p.title}</span>
              <span className="ps-practice-sub">{p.subtitle}</span>
              <span className="ps-practice-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>
            </button>
          );
        })}
      </div></div>
      {active && <QuickPracticeSheet id={active} onClose={() => setActive(null)} />}
    </section>
  );
}
