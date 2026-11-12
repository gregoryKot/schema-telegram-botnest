import type { ModeMapKind } from '../../api';
import { useTr } from '../../utils/addressForm';
import { KIND_META, MAP_KINDS } from './mapKinds';
import { MapKindButton } from './MapKindButton';

const LINK_NOTE = 'Карты связаны с концептуализацией клиента: режимы, схемы и линии схема — режим с карты дописываются в поля, а удаление с карты поля не трогает. Карта пары живёт отдельно.';

/**
 * Пять типов графической карты (#963) — один список на меню «Новая карта» (строка со знаком типа) и плитки бумаги экрана
 * «нет карт» (знак и оттенок — kindLook.ts). «Концептуализация» недоступна, пока поля грузятся, когда собирать не из чего
 * и когда поля не загрузились: подсказка говорит это прямо. Под типами — строка о связи карт с полями.
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
        <MapKindButton key={k} kind={k} variant={variant} onPick={onPick} disabled={disabled || (k === 'concept' && concept !== 'ready')}
          hint={(k === 'concept' && conceptHint[concept]) || KIND_META[k].hint} />
      ))}
      <p className="mm2-kind-hint mm2-kinds-note">{LINK_NOTE}</p>
    </>
  );
}
