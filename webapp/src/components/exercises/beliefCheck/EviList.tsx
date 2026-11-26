import type { Dispatch, SetStateAction } from 'react';
import { GlyphPlus, GlyphX } from '../ExGlyphs';
import { UndoBar } from '../../UndoBar';
import { useUndoRemove } from '../../../../../shared/src/hooks/useUndoRemove';
import { LimitedInput } from '../../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { glueSpaces } from '../../../../../shared/src/utils/typo';
import { Pebble, type EviSide } from './BeliefParts';

// Список доказательств (за/против) в проверке убеждения: строка — камешок своей чаши (как на весах
// листа-героя), текст и «×» (видна всегда, 44×44; удалённое 5 с можно вернуть — useUndoRemove).
// Поле — во всю ширину, «Добавить» — кнопка-иконка 44×44 справа: подпись «⏎ добавить» резала плейсхолдер.
export function EviList({ items, setItems, input, onInput, onAdd, placeholder, side = 'for' }: {
  items: string[];
  setItems: Dispatch<SetStateAction<string[]>>;
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  side?: EviSide;
}) {
  const undo = useUndoRemove(items, setItems);
  return (
    <div className="ex2-evi">
      {items.map((f, i) => (
        <div key={i} className="ex2-evi-row">
          <Pebble side={side} />
          <span className="ex2-evi-text">{glueSpaces(f)}</span>
          <button className="ex2-evi-x" onClick={() => undo.remove(i)} aria-label="Удалить"><GlyphX /></button>
        </div>
      ))}
      {undo.canUndo && <UndoBar text="Доказательство удалено" onUndo={undo.undo} />}
      <div className="ex2-evi-add">
        <LimitedInput
          max={EXERCISE_TEXT_MAX}
          className="ds-input ex2-evi-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
        />
        <button type="button" aria-label="Добавить" onClick={onAdd}
          className={'ds-btn ds-btn--secondary ex2-evi-go' + (input.trim() ? ' is-ready' : '')}>
          <GlyphPlus />
        </button>
      </div>
    </div>
  );
}
