import { IdentityDot } from '../../components/IdentityDot';
import { conceptChipLook } from './conceptChipStyle';
import { useConceptSkin } from './conceptSkin';

/** Чип-переключатель: на сайте ds-chip с tint по `hue`, в мини-аппе пилюля с точкой. */
export function ConceptToggleChip({
  label,
  color,
  hue,
  active,
  onClick,
  title,
  readOnly = false,
}: {
  label: string;
  color: string;
  hue?: number;
  active: boolean;
  onClick?: () => void;
  title?: string;
  /** Только показать: не кнопка, без зоны нажатия (спокойный вид «выбрано»). */
  readOnly?: boolean;
}) {
  const skin = useConceptSkin();
  const look = conceptChipLook(skin, color, active, readOnly, hue);
  const content = skin ? (
    label
  ) : (
    <>
      <IdentityDot color={color} size={7} /> {label}
    </>
  );
  if (readOnly) return <span {...look}>{content}</span>;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      {...look}
    >
      {content}
    </button>
  );
}
