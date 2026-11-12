// @vitest-environment jsdom
// Экран «Не удалось войти автоматически» в мессенджере: повтор занят — кнопка неактивна с подписью
// загрузки; в слоте кода — только короткий код ответа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TelegramRetry } from './TelegramRetry';
import { glueSpaces } from '../../../../shared/src/utils/typo'; // заголовок PaperOutcome склеивает короткие слова

afterEach(cleanup);

describe('TelegramRetry', () => {
  it('повтор доступен: «Попробовать снова» зовёт onRetry', () => {
    const onRetry = vi.fn();
    render(<TelegramRetry loading={false} error={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.pa-outcome-code')).toBeNull();
  });

  it('повтор идёт: кнопка занята, заголовок на месте', () => {
    render(<TelegramRetry loading error={null} onRetry={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Загрузка...' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('heading', { name: glueSpaces('Не удалось войти автоматически') })).toBeTruthy();
  });

  it('слот кода — «Ошибка 401», без тела ответа', () => {
    render(<TelegramRetry loading={false} error={'Ошибка 401: {"message":"Invalid initData"}'} onRetry={() => {}} />);
    expect(document.querySelector('.pa-outcome-code')?.textContent).toBe('Ошибка 401');
    expect(document.body.textContent).not.toMatch(/Invalid initData/);
  });
});
