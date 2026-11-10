// Группа схем или режимов на живой бумаге (редизайн 2026-11, b15): лист бумаги домена или группы,
// в шапке знак группы 60px и подпись ds-label, внутри — белый список строк (выбор в листах «Мои
// схемы / Мои режимы», «Мои схемы / Мои режимы» экрана «Паттерны»). Тот же вид, что у списка
// режимов дневника (ModeGroupList, b10b) и «Справочника» терапевта: знак группы у подписи, строки
// без точек и цветных рамок. Вид — SheetLook (domainLook, modeGroupLook), а не цвет на месте.
import type { CSSProperties, ReactNode } from 'react';
import type { SheetLook } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/sheet-schemas.css';

interface Props {
  look: SheetLook;
  title: ReactNode;
  /** Справа в шапке: число строк группы. */
  aside?: ReactNode;
  /** Класс белого списка строк (рецепты стенда и тесты ищут строки по нему). */
  rowsClassName?: string;
  children: ReactNode;
}

export function SignGroup({ look, title, aside, rowsClassName, children }: Props) {
  return (
    <section className="pp-paper sg-group" style={{ '--h': look.hue } as CSSProperties}>
      <h3 className="sg-head">
        {look.sign && <span className="sg-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>}
        <span className="ds-label sg-name">{title}</span>
        {aside !== undefined && <span className="sg-aside">{aside}</span>}
      </h3>
      <div className={rowsClassName ? `sg-rows ${rowsClassName}` : 'sg-rows'}>{children}</div>
    </section>
  );
}
