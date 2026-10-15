import { BookingCrisisNote } from './BookingCrisisNote';
/** Поле «Запрос» (необязательно) — общее для простой заявки (BookingForm) и слотов (BookingPicker); под ним кризисная карточка (правило №7). На /book не показывается: знакомому клиенту описывать проблему не нужно. */
export function RequestField({ value, onChange, labelStyle, fieldStyle, minHeight = 84 }: { value: string; onChange: (v: string) => void; labelStyle: React.CSSProperties; fieldStyle: React.CSSProperties; minHeight?: number }) {
  return (
    <div>
      <label style={labelStyle} htmlFor="bp-message">Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
      {/* ym-disable-keys: Вебвизор не пишет ввод — свободный текст клиента. */}
      <textarea id="bp-message" className="ym-disable-keys" style={{ ...fieldStyle, resize: 'vertical', minHeight }} placeholder="Пара слов о том, с чем хотите разобраться" value={value} onChange={(e) => onChange(e.target.value)} maxLength={500} />
      <BookingCrisisNote text={value} />
    </div>
  );
}
