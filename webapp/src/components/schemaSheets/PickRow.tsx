import { GlyphCheck } from '../exercises/ExScreen';
import { pressable } from '../../utils/a11y';
import { hueStyle } from '../../lib/tone';

interface Props {
  name: string;
  desc?: string;
  hue: number | undefined;
  active: boolean;
  onToggle: () => void;
}

/** Строка выбора схемы/режима: цвет домена/группы — через tone-tint, галочка у выбранной. */
export function PickRow({ name, desc, hue, active, onToggle }: Props) {
  return (
    <div
      {...pressable(onToggle)}
      aria-pressed={active}
      className={'ss-pick' + (active ? ' is-selected tone-tint' : '')}
      style={hueStyle(hue)}
    >
      <div className="ss-pick-text">
        <div className="ss-pick-name">{name}</div>
        {desc && <div className="ss-pick-desc">{desc}</div>}
      </div>
      {active && <span className="ss-pick-check tone-fill"><GlyphCheck /></span>}
    </div>
  );
}
