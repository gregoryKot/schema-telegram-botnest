import { pressable } from '../../utils/a11y';
import { hueStyle } from '../../lib/tone';

// Строка выбора схемы/режима в карточных упражнениях: цветной квадрат группы,
// название Literata, короткое описание. Одна механика для SchemaEx и ModeEx.
export function PickRow({ hue, name, desc, onPick }: { hue: number; name: string; desc: string; onPick: () => void }) {
  return (
    <div className="ds-card ds-card--row ds-card--hover ex2-pick" style={hueStyle(hue)} {...pressable(onPick)}>
      <span className="ds-dot tone-fill" />
      <div>
        <div className="ex2-pick-name">{name}</div>
        <div className="ds-sub">{desc}</div>
      </div>
      <span className="ex2-pick-arrow" aria-hidden="true">›</span>
    </div>
  );
}

/** Подпись группы над списком выбора. */
export function PickGroupHead({ hue, children }: { hue: number; children: string }) {
  return <div className="ds-label tone-ink ex2-group-h" style={hueStyle(hue)}>{children}</div>;
}
