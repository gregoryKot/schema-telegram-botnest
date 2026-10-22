import { GlyphPlus, GlyphX } from '../ExScreen';

// Список доказательств (за/против) в проверке убеждения: строки с
// удалением + поле добавления (правило №10). «×» видна всегда, зона 44×44.
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
    <div className="ex2-evi">
      {items.map((f, i) => (
        <div key={i} className="ex2-evi-row">
          <span className="ex2-evi-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="ex2-evi-text">{f}</span>
          <button
            className="ex2-evi-x"
            onClick={() => onRemove(i)}
            aria-label="Удалить"
          >
            <GlyphX />
          </button>
        </div>
      ))}
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
