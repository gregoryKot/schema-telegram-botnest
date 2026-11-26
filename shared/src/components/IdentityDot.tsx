import { needColor } from '../needs/needColors';

export { needColor, NEED_COLOR_ORDER } from '../needs/needColors';

interface Props {
  /** Id потребности — цвет берётся из общего реестра. */
  id?: string;
  /**
   * Готовый цвет, если вызывающая сторона уже его вычислила (режимы — цвет
   * их группы из modesData/schemaTherapyData). Сильнее `id`.
   */
  color?: string;
  size?: number;
}

/**
 * Кружок цвета — опознавательный знак вместо эмодзи, общий для потребностей
 * (волна 5) и режимов (волна 6). Одна механика — один компонент: сперва это
 * был NeedDot, потом IdentityDot, и по копии в каждом фронтенде. Копии были
 * заведомо обречены разъехаться (у них уже отличались тег и aria), поэтому
 * компонент переехал в shared — правило №3 CLAUDE.md.
 *
 * Цвет не единственный носитель смысла: название потребности или режима
 * всегда стоит рядом, а сам кружок декоративный и скрыт от скринридера.
 */
export function IdentityDot({ id, color, size = 10 }: Props) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: color ?? (id ? needColor(id) : 'var(--muted)'),
      }}
    />
  );
}
