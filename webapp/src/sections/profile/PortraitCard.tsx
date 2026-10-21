// Карточка «Мой портрет» в профиле: бары по пяти потребностям, итог теста на
// схемы и дельта с прошлого прохождения. Данные — buildPortrait (shared);
// активность схем здесь не пересчитывается (правило №4). Пустое состояние
// отвечает «откуда и зачем» (правило «Онбординг»). Вся карточка — одно
// действие (открыть лист); «Пройти тест» — вложенная кнопка с stopPropagation.
// Парна schema-miniapp/src/sections/profile/PortraitCard.tsx (вёрстка своя,
// тексты и расчёт — shared/src/portrait).
import type { MouseEvent } from 'react';
import { useTr } from '../../utils/addressForm';
import { fmtDate, momentDayKey } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { hasPortraitData, type Portrait } from '../../../../shared/src/portrait/portraitData';
import { portraitTexts, portraitTotalsText, portraitDeltaText } from '../../../../shared/src/portrait/portraitTexts';
import { PortraitNeedBar } from './PortraitNeedBar';

interface Props {
  portrait: Portrait;
  ysqCompletedAt: string | null;
  onOpenSheet: () => void;
  onTakeTest?: () => void;
}

export function PortraitCard({ portrait, ysqCompletedAt, onOpenSheet, onTakeTest }: Props) {
  const tr = useTr();
  const txt = portraitTexts(tr);
  const hasData = hasPortraitData(portrait);
  const maxCount = Math.max(1, ...portrait.needs.map((n) => n.count));
  const deltaText = portraitDeltaText(portrait.delta);
  const takeTest = (e: MouseEvent) => { e.stopPropagation(); onTakeTest?.(); };

  return (
    <section {...pressable(onOpenSheet)} aria-label={txt.title} className="ds-card ds-card--hover cpf-card">
      <div className="ds-head-row">
        <h2 className="ds-h3">{txt.title}</h2>
        <span className="ds-sub">{hasData ? `${portraitTotalsText(portrait)} →` : '→'}</span>
      </div>
      <div className="cpf-hint">{txt.hint}</div>

      {!hasData && (
        <>
          <div className="ds-sub">{txt.emptyCard}</div>
          {onTakeTest && <button type="button" className="ds-btn ds-btn--secondary cpf-cta" onClick={takeTest}>{txt.takeTest}</button>}
        </>
      )}

      {hasData && (
        <div className="cpf-bars">
          {portrait.needs.map((n) => <PortraitNeedBar key={n.id} n={n} maxCount={maxCount} />)}
        </div>
      )}

      {hasData && ysqCompletedAt && (
        <div className="cpf-foot">
          <span className="ds-sub">Тест на схемы · {fmtDate(momentDayKey(ysqCompletedAt))}</span>
          {deltaText && <span className={`cpf-delta${(portrait.delta ?? 0) < 0 ? ' is-better' : ''}`}>{deltaText}</span>}
        </div>
      )}

      {hasData && !ysqCompletedAt && onTakeTest && (
        <button type="button" className="ds-link cpf-foot-link" onClick={takeTest}>{txt.takeTestArrow}</button>
      )}
    </section>
  );
}
