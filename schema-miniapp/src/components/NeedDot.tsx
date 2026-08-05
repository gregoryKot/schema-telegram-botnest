import { needColor } from '../../../shared/src/needs/needColors';
// Реэкспорт — единая точка входа «всё про порядок/цвет потребности» для
// консьюмеров этого компонента, чтобы не плодить второй import shared в файле.
export {
  needColor,
  NEED_COLOR_ORDER,
} from '../../../shared/src/needs/needColors';

interface Props {
  /** Id потребности — цвет берётся из общего реестра. */
  id?: string;
  /** Готовый цвет, если вызывающая сторона уже его вычислила. Сильнее `id`. */
  color?: string;
  size?: number;
}

// Кружок цвета потребности — опознавательный знак вместо эмодзи (волна 5,
// правило «одна механика — один компонент»). Цвет уже несёт данные (тот же
// на графиках и в трекере), поэтому кружок связывает строку с ними — эмодзи
// такой связи не давал. Название потребности всегда рядом (не единственный
// носитель смысла), кружок декоративный — скрыт от скринридера.
export function NeedDot({ id, color, size = 10 }: Props) {
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
