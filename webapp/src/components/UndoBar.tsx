// Строка «Удалено · Отменить» на время окна отмены (shared/src/hooks/useUndoRemove.ts).
// Стоит в потоке на месте списка, а не тостом поверх: не перекрывает поле
// ввода и не спорит со стеком листов. role="status" — экранный диктор
// прочитает, что строка ушла и её можно вернуть.
export function UndoBar({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <div className="ds-undo" role="status">
      <span>{text}</span>
      <button type="button" className="ds-link" onClick={onUndo}>
        Отменить
      </button>
    </div>
  );
}
