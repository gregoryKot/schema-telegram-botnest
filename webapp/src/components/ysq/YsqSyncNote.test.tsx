// @vitest-environment jsdom
// Сбой синхронизации теста на схемы — общий PaperAlert (ревью g5 r1): знак теста, тексты в обеих формах, свой
// повтор у каждого варианта.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../../../shared/src/utils/addressForm';
import { YsqSyncNote } from './YsqSyncNote';

afterEach(cleanup);

function renderNote(form: 'ty' | 'vy' = 'ty', variant: 'resume-check' | 'result-save' = 'resume-check') {
  const onRetry = vi.fn();
  const view = render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <YsqSyncNote variant={variant} onRetry={onRetry} />
    </AddressFormContext.Provider>,
  );
  return { onRetry, ...view };
}

describe('YsqSyncNote', () => {
  it('форма «ты» — текст с «попробуй»; лист PaperAlert со знаком теста', () => {
    const { container } = renderNote('ty');
    expect(screen.getByText(/сначала попробуй проверить снова/)).toBeTruthy();
    expect(container.querySelector('.pa-alert[role="alert"] .pa-alert-sign')).toBeTruthy();
  });

  it('форма «вы» — текст с «попробуйте»', () => {
    renderNote('vy');
    expect(screen.getByText(/сначала попробуйте проверить снова/)).toBeTruthy();
  });

  it('вариант result-save — свой текст и своя кнопка', () => {
    renderNote('ty', 'result-save');
    expect(screen.getByText(/Результат посчитан и виден только/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отправить ещё раз' })).toBeTruthy();
  });

  it('клик по кнопке повтора вызывает onRetry', () => {
    const { onRetry } = renderNote();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить снова' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
