import type { ReactNode } from 'react';
import type { DialogA11yProps } from '../../../../shared/src/utils/dialogA11y';
import '../../styles/sheet-schemas.css';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { SpreadLayout } from '../paper/SpreadLayout';

interface Props {
  onBack: () => void;
  backLabel?: string;
  zIndex?: number;
  barRight?: ReactNode;
  narrow?: boolean;
  /** Герой листа (SsHead с look — лист сущности) над содержимым; со spread — колонкой слева. */
  hero?: ReactNode;
  /** Разворот на ≥1024: герой слева, содержимое справа (SpreadLayout); уже — герой сверху. */
  spread?: boolean;
  /** Диалоговая семантика (useDialogA11y владельца листа) и имя для диктора: role="dialog", перевод фокуса. */
  dialog?: DialogA11yProps & { 'aria-label': string };
  children: ReactNode;
}

/** Оболочка листа схем/режимов: верхняя полоса с «Назад» + прокручиваемое тело.
 *  Без hero и spread разметка прежняя: экраны переходят на героя по одному (редизайн 2026-11). */
export function SsSheet({ onBack, backLabel = 'Назад', zIndex, barRight, narrow, hero, spread, dialog, children }: Props) {
  const inner = `ss-inner${narrow ? ' ss-inner--narrow' : ''}${spread ? ' ss-inner--spread' : ''}`;
  return (
    <div {...dialog} className="ss-sheet" style={zIndex ? { zIndex } : undefined}>
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={onBack}>
          <GlyphArrowLeft /> {backLabel}
        </button>
        {barRight}
      </div>
      <div className="ss-scroll">
        <div className={inner}>
          {spread ? <SpreadLayout side={hero}>{children}</SpreadLayout> : <>{hero}{children}</>}
        </div>
      </div>
    </div>
  );
}

export { SsHead } from './SsHead';
