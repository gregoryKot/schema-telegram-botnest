import type { Dispatch, SetStateAction } from 'react';
import { GlyphPlus, GlyphX } from '../ExScreen';
import { UndoBar } from '../../UndoBar';
import { useUndoRemove } from '../../../../../shared/src/hooks/useUndoRemove';

// Список доказательств (за/против) в проверке убеждения: строки с
// удалением + поле добавления (правило №10). «×» видна всегда, зона 44×44;
// удалённое 5 с можно вернуть «Отменить» (useUndoRemove).
export function EviList({
  items,
  setItems,
  input,
  onInput,
  onAdd,
  placeholder,
}: {
  items: string[];
  setItems: Dispatch<SetStateAction<string[]>>;
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  const undo = useUndoRemove(items, setItems);
  return (
    <div className="ex2-evi">
      {items.map((f, i) => (
        <div key={i} className="ex2-evi-row">
          <span className="ex2-evi-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="ex2-evi-text">{f}</span>
          <button
            className="ex2-evi-x"
            onClick={() => undo.remove(i)}
            aria-label="Удалить"
          >
            <GlyphX />
          </button>
        </div>
      ))}
      {undo.canUndo && <UndoBar text="Доказательство удалено" onUndo={undo.undo} />}
      <div className="ex2-evi-add">
        <span className="ex2-evi-plus">
          <GlyphPlus />
        </span>
        <input
          className="ds-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
        />
        <button
          className={'ds-btn ds-btn--sm ds-btn--secondary ex2-evi-go' + (input.trim() ? ' is-ready' : '')}
          onClick={onAdd}
        >
          ⏎ добавить
        </button>
      </div>
    </div>
  );
}
