// Полноэкранный исход (docs/design/APP_2026-11.md, «Исходы служебных страниц»): лист по центру — полоса бумаги исхода
// со знаком крупно (тень-вырезка), надпись, заголовок (короткое слово держится со следующим — glueSpaces), лид, одна
// кнопка, тихая ссылка, «код для поддержки». Для загрузки кабинета, ErrorBoundary, RouteErrorScreen, ConnectionTrouble,
// ServicePage, 404, /link, /merge, «спасибо» (ThanksSheet: своя сцена в полосе — art). Лист всегда светлый (light-lock).
import type { ReactNode } from 'react';
import { OUTCOME_LOOK, type Look, type OutcomeId } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { SignHero } from './SignHero';
import { OutcomeBody, type OutcomeAction, type OutcomeBodyProps } from './OutcomeBody';
export type { OutcomeAction };

export interface PaperOutcomeProps extends OutcomeBodyProps {
  /** Исход из OUTCOME_LOOK или вид со знаком (Look — SheetLook со знаком: в полосе знак и есть смысл). */
  outcome: OutcomeId | Look;
  className?: string; /** Своя сцена в полосе вместо знака (лист «спасибо» ThanksSheet — FinalCorners); знак остаётся в data-sign. */ art?: ReactNode;
}

export function PaperOutcome({ outcome, className, art, ...body }: PaperOutcomeProps) {
  const { hue, sign } = typeof outcome === 'string' ? OUTCOME_LOOK[outcome] : outcome;
  return (
    <div className={`light-lock pa-outcome${className ? ` ${className}` : ''}`} style={hueStyle(hue)}>
      <div className="pa-outcome-card" data-sign={sign}>
        <div className="pp-paper pa-outcome-band" aria-hidden="true">{art ?? <SignHero sign={sign} />}</div>
        <OutcomeBody {...body} />
      </div>
    </div>
  );
}
