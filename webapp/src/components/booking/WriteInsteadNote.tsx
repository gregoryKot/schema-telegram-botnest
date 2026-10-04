import { linkBtn } from './linkButtonStyle';

/** Выход из выбора слотов: человек не нашёл время — пишет автору напрямую. */
export function WriteInsteadNote({ onClick }: { onClick: () => void }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.6, margin: 0 }}>
      Не нашли подходящее время? <button type="button" onClick={onClick} style={linkBtn}>Напишите мне</button> – подберём вместе.
    </p>
  );
}
