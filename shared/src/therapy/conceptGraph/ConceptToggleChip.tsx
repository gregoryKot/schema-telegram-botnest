import { IdentityDot } from '../../components/IdentityDot';
import { conceptChipStyle } from './conceptChipStyle';

/**
 * Пилюля-переключатель с точкой цвета: режимы, схемы, потребности в графе и в
 * форме концептуализации — одна механика (правило «одна механика — один
 * компонент»). Текст выбранной пилюли — основной цвет, а не цвет группы:
 * жёлтый домен или потребность на светлой бумаге не читались бы. Цвет несёт
 * точка и кольцо, название всегда стоит рядом.
 */
export function ConceptToggleChip({
  label,
  color,
  active,
  onClick,
  title,
  readOnly = false,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick?: () => void;
  title?: string;
  /** Только показать: не кнопка, без зоны нажатия (спокойный вид «выбрано»). */
  readOnly?: boolean;
}) {
  const style = conceptChipStyle(color, active, readOnly);
  const content = (
    <>
      <IdentityDot color={color} size={7} /> {label}
    </>
  );
  if (readOnly) return <span style={style}>{content}</span>;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      style={style}
    >
      {content}
    </button>
  );
}
