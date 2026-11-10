import { useId, type ReactNode } from 'react';
import type { DragHandleProps } from '../../../../shared/src/hooks/useDragReorder';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  title: string;
  sub: string;
  /** Блок показан? undefined — у блока нет тумблера (только переставляется). */
  on?: boolean;
  onToggle?: () => void;
  /** Ручка «≡»; нет — порядок на этой раскладке не меняется. */
  handle?: DragHandleProps;
  rowRef: (el: HTMLElement | null) => void;
  offsetY: number;
  lifted: boolean;
  /** Подсветка строки: лист открыт долгим нажатием на этот блок. */
  highlighted?: boolean;
  /** Знак блока (BLOCK_META.sign) в колонке 44px слева; выключенный блок — знак бледный. */
  sign?: SignKey;
}

function Text({ title, sub, sign, off }: { title: string; sub: string; sign?: SignKey; off?: boolean }) {
  return (
    <>
      {sign && <span className={off ? 'pp-row-art cz-sign is-off' : 'pp-row-art cz-sign'} aria-hidden="true"><SignArt sign={sign} size="row" /></span>}
      <span className="cz-text">
        <span className="cz-title">{glue(title)}</span>
        <span className="cz-sub">{glue(sub)}</span>
      </span>
    </>
  );
}

// Строка блока в листе «Настроить экран» (любого экрана — «Сегодня», «Профиль», «Паттерны»): подпись (glue) + тумблер (весь
// ряд — label тумблера, тап по тексту переключает; имя тумблера — как есть) и ручка «≡» для перестановки. Тумблер — тот же
// .ds-switch, что в настройках и в листе «+» (включённый — мох). Знак слева (sign) — как у блока на экране; выключенный — бледный.
export function CustomizeRow({ title, sub, on, onToggle, handle, rowRef, offsetY, lifted, highlighted, sign }: Props) {
  const switchId = useId();
  const body: ReactNode = onToggle ? (
    <label htmlFor={switchId} className="cz-row cz-grow">
      <Text title={title} sub={sub} sign={sign} off={!on} />
      <button id={switchId} type="button" role="switch" aria-checked={!!on} aria-label={title} className="ds-switch" onClick={onToggle}>
        <span className="ds-switch-knob" />
      </button>
    </label>
  ) : (
    <div className="cz-row cz-grow">
      <Text title={title} sub={sub} sign={sign} />
    </div>
  );
  return (
    <div
      ref={rowRef}
      className={'cz-block' + (lifted ? ' is-lifted' : '') + (highlighted ? ' is-hl' : '')}
      style={{ transform: `translateY(${offsetY}px)${lifted ? ' scale(1.02)' : ''}` }}
    >
      {body}
      {handle && (
        <div {...handle} className="cz-handle">
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <rect width="18" height="2" rx="1" fill="currentColor" />
            <rect y="6" width="18" height="2" rx="1" fill="currentColor" />
            <rect y="12" width="18" height="2" rx="1" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}
