import { GlyphCheck } from '../exercises/ExScreen';
import { pressable } from '../../utils/a11y';

interface Props {
  name: string;
  desc?: string;
  active: boolean;
  onToggle: () => void;
}

/** Строка выбора схемы/режима в белом списке группы (SignGroup): выбранная — бумага группы (--h
 *  листа группы) с галочкой и жирным именем, а не цветная рамка (APP_2026-11.md, принцип 5). */
export function PickRow({ name, desc, active, onToggle }: Props) {
  return (
    <div {...pressable(onToggle)} aria-pressed={active} className={'ss-pick' + (active ? ' is-selected' : '')}>
      <div className="ss-pick-text">
        <div className="ss-pick-name">{name}</div>
        {desc && <div className="ss-pick-desc">{desc}</div>}
      </div>
      <span className="ss-pick-check" aria-hidden="true"><GlyphCheck /></span>
    </div>
  );
}

/** «Готово · N» в шапке листа выбора: закрывает (выбор сохраняется сразу), число — сколько выбрано. */
export function PickDone({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ds-btn ds-btn--sm ss-done-top">
      Готово{count > 0 ? ` · ${count}` : ''}
    </button>
  );
}
