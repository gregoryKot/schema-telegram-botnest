import { IdentityDot } from '../../components/IdentityDot';
import { colorMix } from '../../utils/colorMix';

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
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '5px 12px',
        borderRadius: 'var(--r-20)',
        border: 'none',
        cursor: 'pointer',
        background: active ? colorMix(color, 22) : 'rgba(var(--fg-rgb),0.05)',
        boxShadow: active ? `inset 0 0 0 1.5px ${colorMix(color, 60)}` : 'none',
        color: active ? 'var(--text)' : 'var(--text-sub)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s ease',
      }}
    >
      <IdentityDot color={color} size={7} /> {label}
    </button>
  );
}
