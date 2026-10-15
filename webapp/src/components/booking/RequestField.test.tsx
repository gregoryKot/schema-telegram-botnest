// @vitest-environment jsdom
// Поле «Запрос» общее для двух ручек с разными пределами DTO (BookingForm →
// 500, BookingPicker → 2000): предел приходит от вызывающего, а не из
// константы внутри поля (backend#29). Иначе одна из форм получила бы 400 или
// обрезанное поле.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RequestField } from './RequestField';
import { BOOKING_MESSAGE_MAX, BOOKING_SLOT_MESSAGE_MAX } from '../../../../shared/src/limits/textLimits';

afterEach(cleanup);

function field(max: number, value = '') {
  render(<RequestField value={value} onChange={() => {}} labelStyle={{}} fieldStyle={{}} max={max} />);
  return screen.getByLabelText(/Запрос/) as HTMLTextAreaElement;
}

describe('RequestField', () => {
  it('maxLength поля равен пределу, который передал вызывающий', () => {
    expect(field(BOOKING_MESSAGE_MAX).maxLength).toBe(500);
    cleanup();
    expect(field(BOOKING_SLOT_MESSAGE_MAX).maxLength).toBe(2000);
  });

  it('у границы показывает остаток и привязывает его к полю', () => {
    const area = field(BOOKING_MESSAGE_MAX, 'а'.repeat(480));
    expect(screen.getByText('Осталось знаков: 20')).toBeTruthy();
    expect(area.getAttribute('aria-describedby')).toBe('bp-message-limit');
  });
});
