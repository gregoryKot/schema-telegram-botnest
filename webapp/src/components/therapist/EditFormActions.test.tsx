// @vitest-environment jsdom
// «Сохранить / Отмена» форм правки в сайдбаре «Обзора» — один компонент на три
// карточки (#906): на бумаге «Сохранить» — primary, на акцентной карточке —
// secondary (primary слился бы с заливкой); ошибка — alert; пока идёт
// сохранение — «...» и кнопка недоступна.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditFormActions } from './EditFormActions';

afterEach(cleanup);

describe('EditFormActions', () => {
  it('на бумаге: «Сохранить» primary зовёт onSave, «Отмена» — onCancel, ошибка — tk-error', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<EditFormActions saving={false} error="Не удалось сохранить дату" onSave={onSave} onCancel={onCancel} />);
    const save = screen.getByRole('button', { name: 'Сохранить' });
    expect(save.className).toBe('ds-btn ds-btn--sm');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').className).toBe('tk-error');
  });

  it('без ошибки alert нет', () => {
    render(<EditFormActions saving={false} error="" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('пока идёт сохранение — «...» и кнопка недоступна', () => {
    render(<EditFormActions saving error="" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect((screen.getByRole('button', { name: '...' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('подсказка к вводу: «Сохранить» недоступна, подсказка стоит на месте ошибки', () => {
    const onSave = vi.fn();
    const { rerender } = render(<EditFormActions saving={false} error="Ошибка сети" hint="Укажи время встречи" onSave={onSave} onCancel={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Укажи время встречи');
    expect(screen.getByRole('alert').className).toBe('ds-sub');
    rerender(<EditFormActions saving={false} error="Ошибка сети" hint={null} onSave={onSave} onCancel={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('alert').textContent).toBe('Ошибка сети');
    expect(screen.getByRole('alert').className).toBe('tk-error');
  });
});
