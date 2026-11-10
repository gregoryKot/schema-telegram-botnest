import type { ReactNode } from 'react';
import { SignArt } from '../art/SignArt';
import type { FlashcardSummaryParts } from './flashcardLook';
import type { SignKey } from '../../../../shared/src/theme/entityLook';

/** Строка итога: знак слева (режим, потребность), надпись и значение; текст человека — Literata. */
function Row({ label, sign, serif, children }: { label: string; sign?: SignKey; serif?: boolean; children: ReactNode }) {
  return (
    <div className="sk-fc-row">
      <span className="sk-fc-row-sign" aria-hidden="true">{sign && <SignArt sign={sign} size="row" />}</span>
      <div className="sk-fc-row-body">
        <div className="ds-label sk-fc-row-label">{label}</div>
        <div className={serif ? 'sk-fc-value sk-fc-value--text' : 'sk-fc-value'}>{children}</div>
      </div>
    </div>
  );
}

/** Строки карточки «Мне плохо» — одни на итог «Сохранено» и просмотр из истории: режим со знаком
 *  группы, рефлексия, потребность с NeedArt, шаг. Пустое и неузнанное не рисуется. */
export function FlashcardRows({ parts, reflection, action }: { parts: FlashcardSummaryParts; reflection?: string; action?: string }) {
  return (
    <div className="sk-fc-rows">
      {parts.mode && <Row label="Режим" sign={parts.mode.sign}>{parts.mode.label}</Row>}
      {reflection && <Row label="Рефлексия" serif>{reflection}</Row>}
      {parts.need && <Row label="Потребность" sign={parts.need.sign}>{parts.need.label}</Row>}
      {action && <Row label="Шаг" serif>{action}</Row>}
    </div>
  );
}
