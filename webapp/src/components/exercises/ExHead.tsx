// Шапка экрана упражнения (ExScreen): надпись, заголовок, подводка и «самопомощь».
//  • Без look — прежняя шапка: art (картинка над надписью), заголовок ds-h2, подводка ds-sub.
//  • С look — герой на бумаге упражнения (EntitySheet, редизайн 2026-11): надпись, Literata 32,
//    подводка и знак сущности крупно справа (на развороте — сверху). heroArt — своя сцена с
//    данными вместо знака (SceneChildhood values); прежний art при look не рисуется — картинка
//    над надписью и сцена героя разные вещи, и сцена не должна пропадать молча. compact — второй
//    и следующие шаги.
// Предупреждение «самопомощь» (`caution` — готовый TherapyCaution от ExScreen) стоит под шапкой,
// только если экран так выбрал: у героя ExScreen ставит его под кнопки (принцип 5).
import type { ReactNode } from 'react';
import type { EntityId, SheetLook } from '../../../../shared/src/theme/entityLook';
import { EntitySheet } from '../paper/EntitySheet';

export interface ExHeadProps {
  eyebrow: ReactNode;
  /** Картинка над надписью у прежней шапки (без look). */
  art?: ReactNode;
  /** Сцена героя вместо знака сущности (только с look). */
  heroArt?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Бумага и знак героя: сущность из ENTITY_LOOK или готовый вид (домен, группа режима). */
  look?: EntityId | SheetLook;
  compact?: boolean;
}

export function ExHead({ eyebrow, art, heroArt, title, lede, look, compact, caution: warn }: ExHeadProps & { caution?: ReactNode }) {
  if (look !== undefined) {
    return (
      <>
        <EntitySheet look={look} label={eyebrow} title={title} sub={lede} art={heroArt} compact={compact} titleAs="h1" className="ex2-hero" />
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
