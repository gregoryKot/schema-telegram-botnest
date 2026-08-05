import {
  needColor,
  NEED_COLOR_ORDER,
} from '../../../shared/src/needs/needColors';

export { NEED_COLOR_ORDER };

interface NeedDotProps {
  /** Id потребности (attachment/autonomy/…) — цвет ищется через needColor(). */
  id?: string;
  /** Готовый цвет, если он уже вычислен вызывающей стороной. Побеждает `id`. */
  color?: string;
  size?: number;
}

/**
 * Опознавательный знак потребности — цветная точка вместо бывшей эмодзи
 * (волна 5 отказа от эмодзи). Цвет — из shared/needs/needColors, единственный
 * источник (правило №3/№4 CLAUDE.md), поэтому у точки нет своей копии палитры.
 */
export function NeedDot({ id, color, size = 10 }: NeedDotProps) {
  const dotColor = color ?? (id ? needColor(id) : 'var(--muted)');
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: dotColor,
        flexShrink: 0,
      }}
    />
  );
}
