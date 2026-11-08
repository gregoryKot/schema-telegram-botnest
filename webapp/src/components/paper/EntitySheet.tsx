// Лист-герой сущности (редизайн приложения 2026-11, docs/design/APP_2026-11.md, принцип 4):
// цветная бумага оттенка сущности, надпись ds-label, вопрос или название Literata 32, подпись,
// справа знак сущности крупно с тенью-вырезкой — как плитки «Сегодня» и лендинга. Вид берётся
// из ENTITY_LOOK по id сущности или готовым Look (домен, группа режима, потребность), а не
// выбирается на месте. Заменяет одинокий Ribbon над полем, NeedArt 16px в заголовке и «2» на 2FA.
//  • compact — второй и следующие шаги того же потока: тот же лист, знак 72px, Literata 28;
//  • art — своя сцена вместо знака (Strokes values, SceneCheckIn) — данные несёт сцена;
//  • meta — строка из данных под подписью («Шаг 2 из 4», «Сегодня 2 записи»);
//  • в развороте (SpreadLayout) на ≥1024 лист встаёт колонкой: знак сверху, крупнее.
// Декор (знак, сцена) скрыт от чтения с экрана — смысл несут заголовок и подпись.
import type { CSSProperties, ReactNode } from 'react';
import { ENTITY_LOOK, type EntityId, type SignKey } from '../../../../shared/src/theme/entityLook';
import { SignHero } from './SignHero';
import '../../styles/paper-app.css';

/** Вид листа: бумага и знак; без знака и без art лист стоит без картинки. */
export interface SheetLook {
  hue: number;
  sign?: SignKey;
}

export interface EntitySheetProps {
  /** Сущность из ENTITY_LOOK или готовый вид (domainLook, modeGroupLook, needLook). */
  look: EntityId | SheetLook;
  label?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  /** Своя картинка вместо знака сущности (сцена с данными). */
  art?: ReactNode;
  compact?: boolean;
  /** Уровень заголовка: h1 — герой экрана-потока, h2 — лист внутри страницы. */
  titleAs?: 'h1' | 'h2';
  className?: string;
  children?: ReactNode;
}

export function EntitySheet({ look, label, title, sub, meta, art, compact, titleAs: Title = 'h2', className, children }: EntitySheetProps) {
  const { hue, sign }: SheetLook = typeof look === 'string' ? ENTITY_LOOK[look] : look;
  const picture = art ?? (sign ? <SignHero sign={sign} /> : null);
  const cls = ['pp-paper', 'pa-sheet', compact && 'pa-sheet--compact', !picture && 'pa-sheet--plain', className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--h': hue } as CSSProperties} data-sign={art ? undefined : sign}>
      <div className="pa-sheet-body">
        {label && <span className="ds-label pa-sheet-label">{label}</span>}
        <Title className="pa-sheet-title">{title}</Title>
        {sub && <p className="pa-sheet-sub">{sub}</p>}
        {meta && <div className="pa-sheet-meta">{meta}</div>}
        {children}
      </div>
      {picture && <div className="pa-sheet-art" aria-hidden="true">{picture}</div>}
    </div>
  );
}
