import { GlyphPlus, GlyphX } from '../ExScreen';

// Список доказательств (за/против) в проверке убеждения: строки с
// удалением + поле добавления. Вынесено из BeliefCheckEx.tsx (правило №10).
export function EviList({
  items,
  onRemove,
  input,
  onInput,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (i: number) => void;
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="evi-list">
      {items.map((f, i) => (
        <div key={i} className="evi-row">
          <span className="evi-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="evi-text">{f}</span>
          <button
            className="evi-x"
            onClick={() => onRemove(i)}
            aria-label="Удалить"
          >
            <GlyphX />
          </button>
        </div>
      ))}
      <div className="evi-add">
        <span className="evi-add-plus">
          <GlyphPlus />
        </span>
        <input
          className="evi-add-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
        />
        <button
          className={'evi-add-go ' + (input.trim() ? 'ready' : '')}
          onClick={onAdd}
        >
          ⏎ добавить
        </button>
      </div>
    </div>
  );
}
