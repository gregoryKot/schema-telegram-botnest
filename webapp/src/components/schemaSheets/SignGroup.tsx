// Группа схем или режимов на живой бумаге (редизайн 2026-11, b15): лист бумаги домена или группы,
// в шапке знак группы 60px и подпись ds-label, внутри — белый список строк (выбор в листах «Мои
// схемы / Мои режимы», «Мои схемы / Мои режимы» экрана «Паттерны», группы режимов «Справочника»
// клиента — b16). Тот же вид, что у списка режимов дневника (ModeGroupList, b10b) и «Справочника»
// терапевта: знак группы у подписи, строки без точек и цветных рамок. Вид — SheetLook (domainLook,
// modeGroupLook), а не цвет на месте.
import type { CSSProperties, ReactNode } from 'react';
import type { SheetLook, SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/sheet-schemas.css';

interface Props {
  look: SheetLook;
  /** Несколько знаков у подписи вместо `look.sign`: группа собирает разные стили (копинги справочника —
   *  Yield, Shelter, Shield). Знаки 44 вплотную, подпись на узком листе уходит под них. */
  signs?: readonly SignKey[];
  title: ReactNode;
  /** Справа в шапке: число строк группы. */
  aside?: ReactNode;
  /** Класс белого списка строк (рецепты стенда и тесты ищут строки по нему). */
  rowsClassName?: string;
  children: ReactNode;
}

export function SignGroup({ look, signs, title, aside, rowsClassName, children }: Props) {
  const many = signs !== undefined && signs.length > 1;
  const one = many ? undefined : (signs?.[0] ?? look.sign);
  return (
    <section className="pp-paper sg-group" style={{ '--h': look.hue } as CSSProperties}>
      <h3 className={many ? 'sg-head is-many' : 'sg-head'}>
        {one && <span className="sg-sign" aria-hidden="true"><SignArt sign={one} size="square" /></span>}
        {many && (
          <span className="sg-signs" aria-hidden="true">
            {signs.map((s) => <span key={s} className="sg-sign"><SignArt sign={s} size="square" /></span>)}
          </span>
        )}
        <span className="ds-label sg-name">{title}</span>
        {aside !== undefined && <span className="sg-aside">{aside}</span>}
      </h3>
      <div className={rowsClassName ? `sg-rows ${rowsClassName}` : 'sg-rows'}>{children}</div>
    </section>
  );
}
