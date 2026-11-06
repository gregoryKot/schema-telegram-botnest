import type { ModeMapKind } from '../../api';
import { useTr } from '../../utils/addressForm';
import { KIND_META, MAP_KINDS } from './mapKinds';

/**
 * Пять типов графической карты (#963) — один список на меню «Новая карта» и
 * карточки экрана «нет карт». «Концептуализация» недоступна, пока поля грузятся
 * (без спиннера) и когда собирать не из чего: тогда подсказка говорит, что
 * сделать, прямо вместо описания типа.
 */
export function MapKindPicker({ variant, concept, disabled, onPick }: {
  variant: 'menu' | 'cards';
  concept: 'loading' | 'empty' | 'ready';
  disabled?: boolean;
  onPick: (kind: ModeMapKind) => void;
}) {
  const tr = useTr();
  return (
    <>
      {MAP_KINDS.map(k => {
        const off = k === 'concept' && concept !== 'ready';
        const hint = k === 'concept' && concept === 'empty'
          ? tr('Заполни поля концептуализации, и карта соберётся сама', 'Заполните поля концептуализации, и карта соберётся сама')
          : KIND_META[k].hint;
        return (
          <button key={k} type="button" onClick={() => onPick(k)} disabled={disabled || off}
            className={variant === 'menu' ? 'ds-menu-item' : 'ds-card ds-card--hover mm2-kind-card'}>
            <div className="mm2-kind-name">{KIND_META[k].label}</div>
            <div className="mm2-kind-hint">{hint}</div>
          </button>
        );
      })}
    </>
  );
}
