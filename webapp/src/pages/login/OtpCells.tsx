import { forwardRef } from 'react';

import { OTP_LENGTH, normalizeOtp } from './otp';

// Шесть ячеек поверх одного настоящего input: вставка и автозаполнение
// one-time-code работают как у обычного поля.
export const OtpCells = forwardRef<HTMLInputElement, {
  value: string; onChange: (v: string) => void; disabled: boolean; label: string;
}>(function OtpCells({ value, onChange, disabled, label }, ref) {
  const active = Math.min(value.length, OTP_LENGTH - 1);
  return (
    <div className="al-cells">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`al-cell${i === active && !disabled ? ' is-active' : ''}`}
        >
          {value[i] ?? ''}
        </div>
      ))}
      <input
        ref={ref}
        className="al-cells-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        placeholder="123456"
        value={value}
        maxLength={OTP_LENGTH + 4}
        onChange={e => onChange(normalizeOtp(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
});
