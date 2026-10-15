import { btn, input } from './shared';
import { parsePriceInput, PRICE_MAX } from './priceInput';

/** Строка «название · поле суммы · ₽ · Сохранить» для цен сессии и подписки.
 *  Пустое или недопустимое значение не сохраняется: кнопка неактивна. */
export function PriceRow({ label, value, min, onChange, onSave }: {
  label: string;
  value: string;
  min: number;
  onChange: (raw: string) => void;
  onSave: (price: number) => void;
}) {
  const price = parsePriceInput(value, min);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: '6px 0', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, color: 'var(--text)', fontSize: 14 }}>{label}</span>
      <input type="number" min={min} max={PRICE_MAX} value={value} aria-invalid={price === null}
        onChange={(e) => onChange(e.target.value)} style={{ ...input, width: 110 }} />
      <span className="u-faint">₽</span>
      <button style={{ ...btn, opacity: price === null ? 0.5 : 1 }} disabled={price === null}
        onClick={() => price !== null && onSave(price)}>Сохранить</button>
      {price === null && (
        <span style={{ width: '100%', fontSize: 12, color: 'var(--accent-red)' }}>
          Сумма — целое число от {min} до {PRICE_MAX.toLocaleString('ru-RU')} ₽
        </span>
      )}
    </div>
  );
}
