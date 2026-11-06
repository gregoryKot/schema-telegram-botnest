import type { ModeMapKind } from '../../api';
import { useTr } from '../../utils/addressForm';
import { KIND_META, MAP_KINDS } from './mapKinds';

const LINK_NOTE = 'Карты связаны с концептуализацией клиента: режимы, схемы и линии схема — режим с карты дописываются в поля, а удаление с карты поля не трогает. Карта пары живёт отдельно.';

/**
 * Пять типов графической карты (#963) — один список на меню «Новая карта» и карточки экрана «нет карт».
 * «Концептуализация» недоступна, пока поля грузятся (без спиннера), когда собирать не из чего и когда поля
 * не загрузились: тогда подсказка говорит это прямо вместо описания типа. Под типами — строка о связи карт
 * с полями: терапевт узнаёт о ней до первой карты, а не по сюрпризу в полях.
 */
export function MapKindPicker({ variant, concept, disabled, onPick }: {
  variant: 'menu' | 'cards';
  concept: 'loading' | 'empty' | 'failed' | 'ready';
  disabled?: boolean;
  onPick: (kind: ModeMapKind) => void;
}) {
  const tr = useTr();
  const conceptHint: Partial<Record<typeof concept, string>> = { failed: 'Концептуализация не загрузилась — собрать карту из неё сейчас нельзя',
    empty: tr('Заполни поля концептуализации, и карта соберётся сама', 'Заполните поля концептуализации, и карта соберётся сама') };
  return (
    <>
      {MAP_KINDS.map(k => (
        <button key={k} type="button" onClick={() => onPick(k)} disabled={disabled || (k === 'concept' && concept !== 'ready')}
          className={variant === 'menu' ? 'ds-menu-item' : 'ds-card ds-card--hover mm2-kind-card'}>
          <div className="mm2-kind-name">{KIND_META[k].label}</div>
          <div className="mm2-kind-hint">{(k === 'concept' && conceptHint[concept]) || KIND_META[k].hint}</div>
        </button>
      ))}
      <p className="mm2-kind-hint mm2-kinds-note">{LINK_NOTE}</p>
    </>
  );
}
