// @vitest-environment jsdom
// Сбой строкой (редизайн 2026-11): лист соломы по умолчанию, бледный знак сущности, две фразы,
// «Повторить» второстепенной кнопкой; повтор идёт — кнопка неактивна; без onRetry кнопки нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PaperAlert } from './PaperAlert';

afterEach(cleanup);

describe('PaperAlert', () => {
  it('alert на бумаге соломы: заголовок и пояснение, без кнопки и знака по умолчанию', () => {
    const { container } = render(<PaperAlert title="Записи не загрузились" text="Сервер не ответил" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toBe('pp-paper pa-alert');
    expect(alert.style.getPropertyValue('--h')).toBe('70');
    expect(alert.querySelector('.pa-alert-title')?.textContent).toBe('Записи не загрузились');
    expect(alert.querySelector('.pa-alert-text')?.textContent).toBe('Сервер не ответил');
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('.pa-alert-sign')).toBeNull();
  });

  it('знак сущности — строкой и скрыт от чтения; «Повторить» зовёт onRetry', () => {
    const onRetry = vi.fn();
    const { container } = render(<PaperAlert title="Не загрузилось" sign="pebbles" onRetry={onRetry} />);
    const sign = container.querySelector('.pa-alert-sign')!;
    expect(sign.getAttribute('aria-hidden')).toBe('true');
    expect(sign.querySelector('svg.pp-art--row')).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Повторить' });
    expect(retry.className).toContain('ds-btn--secondary');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('повтор идёт — кнопка неактивна; своя подпись, бумага и спокойная роль status', () => {
    render(<PaperAlert title="Сохраняем снова" onRetry={() => {}} retryLabel="Ещё раз" retrying hue={45} role="status" />);
    const box = screen.getByRole('status');
    expect(box.style.getPropertyValue('--h')).toBe('45');
    expect((screen.getByRole('button', { name: 'Ещё раз' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
