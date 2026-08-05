import {
  needColor,
  NEED_COLOR_ORDER,
} from '../../../shared/src/needs/needColors';

export { NEED_COLOR_ORDER };

interface IdentityDotProps {
  /** Id потребности (attachment/autonomy/…) — цвет ищется через needColor(). */
  id?: string;
  /** Готовый цвет, если он уже вычислен вызывающей стороной (напр. цвет группы режимов). Побеждает `id`. */
  color?: string;
  size?: number;
}

/**
 * Опознавательный знак потребности/режима — цветная точка вместо бывшей
 * эмодзи (волна 5 — потребности, волна 6 — режимы, отказ от эмодзи).
 * Для потребностей цвет — из shared/needs/needColors, единственный источник
 * (правило №3/№4 CLAUDE.md); для режимов цвет группы передаётся готовым
 * через `color`, у точки нет своей копии палитры.
 */
export function IdentityDot({ id, color, size = 10 }: IdentityDotProps) {
  const dotColor = color ?? (id ? needColor(id) : 'var(--muted)');
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        width: size,
        height: size,
        borderRadius: '50%',
        background: dotColor,
        flexShrink: 0,
      }}
    />
  );
}
