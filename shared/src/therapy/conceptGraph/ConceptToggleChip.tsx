import { IdentityDot } from '../../components/IdentityDot';
import type { PaperHue, SignKey } from '../../theme/entityLook';
import { conceptChipStyle } from './conceptChipStyle';
import { ConceptTag, useConceptPaper } from './conceptPaper';

/** Чип-переключатель: на сайте SignChip (выбранный — бумага `hue` с галочкой), без сайта — пилюля с точкой. */
export function ConceptToggleChip({
  label,
  color,
  hue,
  sign,
  active,
  onClick,
  readOnly = false,
}: {
  label: string;
  color: string;
  hue?: number;
  /** Знак сущности у невыбранного чипа и у чипа «только показать». */
  sign?: SignKey;
  active: boolean;
  onClick?: () => void;
  /** Только показать: не кнопка, белый чип со знаком. */
  readOnly?: boolean;
}) {
  const paper = useConceptPaper();
  if (readOnly) return <ConceptTag sign={sign}>{label}</ConceptTag>;
  const toggle = () => onClick?.();
  if (paper) {
    const chip = { label, sign, on: active, hue: hue as PaperHue | undefined };
    return <paper.Chip {...chip} onToggle={toggle} />;
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={toggle}
      style={conceptChipStyle(color, active, false)}
    >
      <IdentityDot color={color} size={7} /> {label}
    </button>
  );
}
