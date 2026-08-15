// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { YsqSyncErrorNote } from './YsqSyncErrorNote';

afterEach(() => {
  cleanup();
});

function renderNote(form: 'ty' | 'vy' = 'ty') {
  const onRetry = vi.fn();
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <YsqSyncErrorNote
        ty="Не удалось проверить прогресс — попробуй снова."
        vy="Не удалось проверить прогресс — попробуйте снова."
        retryLabel="Проверить снова"
        onRetry={onRetry}
      />
    </AddressFormContext.Provider>,
  );
  return { onRetry };
}

describe('YsqSyncErrorNote', () => {
  it('форма «ты» — показывает ty-текст', () => {
    renderNote('ty');
    expect(
      screen.getByText('Не удалось проверить прогресс — попробуй снова.'),
    ).toBeTruthy();
  });

  it('форма «вы» — показывает vy-текст', () => {
    renderNote('vy');
    expect(
      screen.getByText('Не удалось проверить прогресс — попробуйте снова.'),
    ).toBeTruthy();
  });

  it('клик по кнопке повтора вызывает onRetry', () => {
    const { onRetry } = renderNote();
    fireEvent.click(screen.getByText('Проверить снова'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
