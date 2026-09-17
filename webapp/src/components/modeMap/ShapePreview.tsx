import type { ShapeOption } from './shapeOptions';
import { previewFill } from './shapeOptions';

// Превью формы ноды в палитре редактора (вынесено из ModeMapNodeEditor.tsx,
// правило №10; react-refresh требует файл только с компонентами).
// All previews drawn in a fixed 24x24 box so picker borders align perfectly
export function ShapePreview({ opt, active }: { opt: ShapeOption; active: boolean }) {
  const stroke = active ? 'var(--accent)' : opt.color;
  const fill = previewFill(opt.color);
  const sw = 1.6;
  const paths: Record<string, string> = {
    critic: 'M4,1 L20,1 L23,4 L23,20 L20,23 L4,23 L1,20 L1,4 Z',     // octagon
    over:   'M12,1 L23,9 L19,23 L5,23 L1,9 Z',                        // pentagon
    avoid:  'M2,2 L22,2 L22,16 L12,23 L2,16 Z',                       // shield
  };
  const key = opt.copingSubtype === 'over' ? 'over'
    : opt.copingSubtype === 'avoid' ? 'avoid'
    : opt.type === 'critic' ? 'critic' : null;

  return (
    <svg width={22} height={22} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {opt.isCloud ? (
        <path d="M6,18 Q2,18 2,14 Q2,9 7,9 Q6,3 12,3 Q16,1 19,4 Q23,4 23,9 Q23,18 18,18 Z"
          fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.isCircle ? (
        <circle cx={12} cy={12} r={10.5} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.copingSubtype === 'surr' ? (
        <rect x={1} y={6} width={22} height={12} rx={6} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.type === 'behavior' ? (
        <path d="M2,4 L18,4 L22,12 L18,20 L2,20 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : key ? (
        <path d={paths[key]} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : (
        <rect x={2} y={4} width={20} height={16} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
    </svg>
  );
}
