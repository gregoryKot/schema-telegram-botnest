import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { ArtProps } from '../art/paper';
import { Strokes } from '../art/PaperArt';
import { SignArt } from '../art/SignArt';

// Знак в «Зачем это всё» (лист «Трекер» в WhyThree, строка «Полоска» в WhyLegend): полоски — палитрой
// потребностей, как заполненный день на главной. Лист объясняет главную, и трекер на нём выглядит так же,
// а не обезличенной гаммой знака меню (ревью владельца g1 r2). Все пять во всю высоту: это знак, а не
// чей-то день — данных пользователя здесь нет. Остальные знаки — по ключу, как везде (SignArt).
const NEEDS_SIGN = [10, 10, 10, 10, 10] as const;

export function WhySign({ sign, size }: { sign: SignKey; size: ArtProps['size'] }) {
  return sign === 'strokes' ? <Strokes size={size} values={NEEDS_SIGN} /> : <SignArt sign={sign} size={size} />;
}
