import type { Tr } from '../../../../shared/src/practices/quickPractices';
import { glue } from '../../../../shared/src/utils/typo';

// Подсказка про порядок блоков (glue). Ручка «≡» есть только на телефоне: на широком экране блоки на своих местах.
export function ReorderHint({ tr, phone, noun = 'блоков' }: { tr: Tr; phone: boolean; noun?: string }) {
  return (
    <div className="ds-sub cz-hint">
      {glue(phone
        ? tr(`Порядок ${noun} меняется за ручку «≡» — тяни её вверх или вниз.`, `Порядок ${noun} меняется за ручку «≡» — тяните её вверх или вниз.`)
        : 'Порядок блоков меняется на телефоне: на широком экране у блоков своё место.')}
    </div>
  );
}
