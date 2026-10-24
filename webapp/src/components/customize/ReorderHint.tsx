import type { Tr } from '../../../../shared/src/practices/quickPractices';

// Подсказка про порядок блоков. Ручка «≡» есть только на телефоне: на широком
// экране блоки стоят в двух колонках на своих местах, переставлять нечего.
export function ReorderHint({ tr, phone, noun = 'блоков' }: { tr: Tr; phone: boolean; noun?: string }) {
  return (
    <div className="ds-sub cz-hint">
      {phone
        ? tr(`Порядок ${noun} меняется за ручку «≡» — тяни её вверх или вниз.`, `Порядок ${noun} меняется за ручку «≡» — тяните её вверх или вниз.`)
        : 'Порядок блоков меняется на телефоне: на широком экране у блоков своё место.'}
    </div>
  );
}
