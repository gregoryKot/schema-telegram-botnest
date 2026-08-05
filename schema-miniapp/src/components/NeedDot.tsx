import { needColor } from '../../../shared/src/needs/needColors';
// Реэкспорт — единая точка входа «всё про порядок/цвет потребности» для
// консьюмеров этого компонента, чтобы не плодить второй import shared в файле.
export {
  needColor,
  NEED_COLOR_ORDER,
} from '../../../shared/src/needs/needColors';

interface Props {
  id: string;
  size?: number;
}

// Кружок цвета потребности — опознавательный знак вместо эмодзи (волна 5,
// правило «одна механика — один компонент»). Цвет уже несёт данные (тот же
// на графиках и в трекере), поэтому кружок связывает строку с ними — эмодзи
// такой связи не давал. Название потребности всегда рядом (не единственный
// носитель смысла), кружок декоративный — скрыт от скринридера.
export function NeedDot({ id, size = 10 }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: needColor(id),
      }}
    />
  );
}
