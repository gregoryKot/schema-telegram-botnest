// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { YsqSyncErrorNote } from './YsqSyncErrorNote';

afterEach(() => {
  cleanup();
});

function renderNote(
  form: 'ty' | 'vy' = 'ty',
  variant: 'resume-check' | 'result-save' = 'resume-check',
) {
  const onRetry = vi.fn();
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <YsqSyncErrorNote variant={variant} onRetry={onRetry} />
    </AddressFormContext.Provider>,
  );
  return { onRetry };
}

describe('YsqSyncErrorNote', () => {
  it('форма «ты» — текст с «попробуй»', () => {
    renderNote('ty');
    expect(screen.getByText(/сначала попробуй проверить снова/)).toBeTruthy();
  });

  it('форма «вы» — текст с «попробуйте»', () => {
    renderNote('vy');
    expect(screen.getByText(/сначала попробуйте проверить снова/)).toBeTruthy();
  });

  it('вариант result-save — свой текст и своя кнопка', () => {
    renderNote('ty', 'result-save');
    expect(screen.getByText(/Результат посчитан и виден только/)).toBeTruthy();
    expect(screen.getByText('Отправить ещё раз')).toBeTruthy();
  });

  it('клик по кнопке повтора вызывает onRetry', () => {
    const { onRetry } = renderNote();
    fireEvent.click(screen.getByText('Проверить снова'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
