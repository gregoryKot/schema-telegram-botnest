// Группа схем или режимов на живой бумаге (редизайн 2026-11, b15): лист бумаги домена или группы,
// в шапке знак группы 60px и подпись ds-label, внутри — белый список строк (выбор в листах «Мои
// схемы / Мои режимы», «Мои схемы / Мои режимы» экрана «Паттерны», группы режимов «Справочника»
// клиента — b16). Тот же вид, что у списка режимов дневника (ModeGroupList, b10b) и «Справочника»
// терапевта: знак группы у подписи, строки без точек и цветных рамок. Вид — SheetLook (domainLook,
// modeGroupLook), а не цвет на месте. Шапка — SignGroupHead: её же берут группы результата теста
// (YsqNeedHead, знак потребности), одна шапка вместо копии .ss-group-* (ревью g5 r1).
import type { CSSProperties, ReactNode } from 'react';
import type { SheetLook, SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import { glueIf } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-schemas.css';

interface HeadProps {
  /** Знаки у подписи: один — 60, несколько (копинги справочника — Yield, Shelter, Shield) — 44 вплотную,
   *  подпись на узком листе уходит под них. */
  signs: readonly SignKey[];
  title: ReactNode;
  /** Справа в шапке: число строк группы. */
  aside?: ReactNode;
  className?: string; as?: 'h2' | 'h3'; // h2 — группа прямо на странице («Справочник» терапевта)
}

export function SignGroupHead({ signs, title, aside, className, as: Head = 'h3' }: HeadProps) {
  const many = signs.length > 1;
  const cls = ['sg-head', many && 'is-many', className].filter(Boolean).join(' ');
  return (
    <Head className={cls}>
      {!many && signs[0] && <span className="sg-sign" aria-hidden="true"><SignArt sign={signs[0]} size="square" /></span>}
      {many && (
        <span className="sg-signs" aria-hidden="true">
          {signs.map((s) => <span key={s} className="sg-sign"><SignArt sign={s} size="square" /></span>)}
        </span>
      )}
      <span className="ds-label sg-name">{glueIf(title)}</span>
      {aside !== undefined && <span className="sg-aside">{aside}</span>}
    </Head>
  );
}

interface Props {
  look: SheetLook;
  /** Несколько знаков у подписи вместо `look.sign` (копинги справочника). */
  signs?: readonly SignKey[];
  title?: ReactNode; // без подписи и знака лист стоит без шапки (техники «Справочника» терапевта)
  aside?: ReactNode; label?: string; headAs?: 'h2' | 'h3'; // label — aria-label секции, headAs — уровень заголовка шапки
  /** Класс белого списка строк (рецепты стенда и тесты ищут строки по нему). */
  rowsClassName?: string;
  children: ReactNode;
}

export function SignGroup({ look, signs = look.sign ? [look.sign] : [], title, aside, label, headAs, rowsClassName, children }: Props) {
  return (
    <section className="pp-paper sg-group" aria-label={label} style={{ '--h': look.hue } as CSSProperties}>
      {(title !== undefined || signs.length > 0) && <SignGroupHead signs={signs} title={title} aside={aside} as={headAs} />}
      <div className={rowsClassName ? `sg-rows ${rowsClassName}` : 'sg-rows'}>{children}</div>
    </section>
  );
}
