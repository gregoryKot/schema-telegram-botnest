// «Что дальше» на итоге упражнения — одна плитка на все итоги (правило №3): колесо детства ведёт в «Историю»
// трекера, проверка убеждения — к карточке схемы. Стили — styles/ex-done.css, рядом с рамкой итога ExDonePage.
import type { CSSProperties } from 'react';
import { SignArt } from '../art/SignArt';
import { ENTITY_LOOK, type EntityId } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';

/** Плитка бумаги той сущности, куда ведёт: текст слева, справа знак и стрелка. С `onOpen` — кнопка во всю
 *  плитку; без него — тот же лист без стрелки, не кнопка. */
export function ExNext({ entity, label, title, text, onOpen, className }: {
  entity: EntityId;
  label: string;
  title: string;
  text: string;
  onOpen?: () => void;
  className?: string;
}) {
  const { hue, sign } = ENTITY_LOOK[entity];
  const body = (
    <>
      <span className="ex2-next-body">
        <span className="ds-label ex2-next-label">{glue(label)}</span>
        <span className="ex2-next-title">{glue(title)}</span>
        <span className="ex2-next-text">{glue(text)}</span>
      </span>
      <span className="ex2-next-foot" aria-hidden="true">
        <SignArt sign={sign} size="square" />
        {onOpen && <span className="pp-arrow">→</span>}
      </span>
    </>
  );
  const cls = ['pp-paper ex2-next', onOpen && 'ex2-next--link', className].filter(Boolean).join(' ');
  const style = { '--h': hue } as CSSProperties;
  return onOpen
    ? <button type="button" className={cls} style={style} onClick={onOpen}>{body}</button>
    : <div className={cls} style={style}>{body}</div>;
}
