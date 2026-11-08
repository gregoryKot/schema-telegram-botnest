// Шапка экрана упражнения (ExScreen): надпись, заголовок, подводка и «самопомощь».
//  • Без look — прежняя шапка: картинка над надписью, заголовок ds-h2, подводка ds-sub.
//  • С look — герой на бумаге упражнения (EntitySheet, редизайн 2026-11): надпись, Literata 32,
//    подводка и знак сущности крупно справа (на развороте — сверху); art — своя картинка героя,
//    если знака по ключу нет. compact — второй и следующие шаги.
// Предупреждение «самопомощь» (`caution` — готовый TherapyCaution от ExScreen) стоит под шапкой:
// у прежней — полное, у героя — строкой (compact): вспомогательное тише листа.
import type { ReactNode } from 'react';
import type { EntityId } from '../../../../shared/src/theme/entityLook';
import { EntitySheet, type SheetLook } from '../paper/EntitySheet';

export interface ExHeadProps {
  eyebrow: ReactNode;
  art?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Бумага и знак героя: сущность из ENTITY_LOOK или готовый вид (домен, группа режима). */
  look?: EntityId | SheetLook;
  compact?: boolean;
}

export function ExHead({ eyebrow, art, title, lede, look, compact, caution: warn }: ExHeadProps & { caution?: ReactNode }) {
  if (look !== undefined) {
    const hasSign = typeof look === 'string' || look.sign !== undefined;
    return (
      <>
        <EntitySheet look={look} label={eyebrow} title={title} sub={lede} art={hasSign ? undefined : art} compact={compact} titleAs="h1" className="ex2-hero" />
        {warn}
      </>
    );
  }
  return (
    <>
      {art}<div className="ds-eyebrow">{eyebrow}</div>
      <h1 className="ds-h2 ex2-title">{title}</h1>
      {lede && <p className="ds-sub ex2-lede">{lede}</p>}
      {warn}
    </>
  );
}
