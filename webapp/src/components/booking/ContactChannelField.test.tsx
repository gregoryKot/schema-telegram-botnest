// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ContactChannelField } from './ContactChannelField';
import type { ContactChannel } from '../../../../shared/src/booking/contactChannel';

afterEach(() => cleanup());

function renderField(over: Partial<React.ComponentProps<typeof ContactChannelField>> = {}) {
  const props = {
    id: 'cf', channel: 'telegram' as ContactChannel, onChannelChange: vi.fn(), value: '', onChange: vi.fn(),
    labelStyle: {}, fieldStyle: {}, ...over,
  };
  const view = render(<ContactChannelField {...props} />);
  return { ...view, props };
}

describe('ContactChannelField', () => {
  it('три чипа, Telegram нажат по умолчанию', () => {
    renderField();
    expect(screen.getByRole('button', { name: 'Telegram' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'WhatsApp' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Почта' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('подпись связана с полем', () => {
    renderField();
    expect(screen.getByLabelText('Где вам удобнее отвечать *').id).toBe('cf');
  });

  it('клик по WhatsApp сообщает о выборе, а плейсхолдер следует за каналом', () => {
    const { props, rerender } = renderField();
    expect(screen.getByPlaceholderText('@username или номер телефона')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(props.onChannelChange).toHaveBeenCalledWith('whatsapp');
    rerender(<ContactChannelField {...props} channel="whatsapp" />);
    expect(screen.getByPlaceholderText('Номер с кодом страны')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WhatsApp' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ввод уходит наружу', () => {
    const { props } = renderField();
    fireEvent.change(screen.getByLabelText('Где вам удобнее отвечать *'), { target: { value: '@anya' } });
    expect(props.onChange).toHaveBeenCalledWith('@anya');
  });

  it('подсказка про закрытый профиль — на номер в Telegram, не на @username', () => {
    const { rerender, props } = renderField({ value: '+79990001122' });
    expect(screen.getByText(/укажите @username/)).toBeTruthy();
    rerender(<ContactChannelField {...props} value="@anya" />);
    expect(screen.queryByText(/укажите @username/)).toBeNull();
  });

  it('подсказка валидации перекрывает подсказку про Telegram и красит поле invalid', () => {
    renderField({ value: '+79990001122', hint: 'Оставьте контакт', invalid: true });
    expect(screen.getByText('Оставьте контакт')).toBeTruthy();
    expect(screen.queryByText(/укажите @username/)).toBeNull();
    const input = screen.getByLabelText('Где вам удобнее отвечать *');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('cf-hint');
  });
});
