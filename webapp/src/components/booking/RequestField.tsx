import { BookingCrisisNote } from './BookingCrisisNote';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
/** Поле «Запрос» (необязательно) — общее для простой заявки (BookingForm) и слотов (BookingPicker); под ним кризисная карточка (правило №7). На /book не показывается: знакомому клиенту описывать проблему не нужно. Предел длины приходит от вызывающего: у двух ручек разные DTO (`BOOKING_MESSAGE_MAX` / `BOOKING_SLOT_MESSAGE_MAX`). ym-disable-keys: Вебвизор не пишет ввод — свободный текст клиента. */
export function RequestField({ value, onChange, labelStyle, fieldStyle, max, minHeight = 84 }: { value: string; onChange: (v: string) => void; labelStyle: React.CSSProperties; fieldStyle: React.CSSProperties; max: number; minHeight?: number }) {
  return (
    <div>
      <label style={labelStyle} htmlFor="bp-message">Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
      <LimitedTextarea id="bp-message" className="ym-disable-keys" style={{ ...fieldStyle, resize: 'vertical', minHeight }} placeholder="Пара слов о том, с чем хотите разобраться" value={value} onChange={(e) => onChange(e.target.value)} max={max} />
      <BookingCrisisNote text={value} />
    </div>
  );
}
