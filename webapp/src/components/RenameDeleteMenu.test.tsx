// @vitest-environment jsdom
// RenameDeleteMenu — «⋯» с «Переименовать / Удалить …» (#906): состав меню,
// отсутствие onDelete, deleteBusy и возврат фокуса на «⋯» после выбора пункта.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RenameDeleteMenu } from './RenameDeleteMenu';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof RenameDeleteMenu>[0]> = {}) => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(<RenameDeleteMenu label="Действия" deleteLabel="Удалить карту" onRename={onRename} onDelete={onDelete} {...over} />);
  const btn = screen.getByRole('button', { name: 'Действия' });
  return { onRename, onDelete, btn, open: () => fireEvent.click(btn) };
};

describe('RenameDeleteMenu', () => {
  it('«⋯» открывает меню с «Переименовать» и подписью удаления', () => {
    const { open } = setup();
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    expect(screen.getByRole('menuitem', { name: 'Переименовать' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Удалить карту' })).toBeTruthy();
  });

  it('без onDelete — только «Переименовать»', () => {
    const { open } = setup({ onDelete: undefined });
    open();
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Переименовать']);
  });

  it('при deleteBusy пункт удаления недоступен', () => {
    const { open } = setup({ deleteBusy: true });
    open();
    expect((screen.getByRole('menuitem', { name: 'Удалить карту' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('выбор пункта зовёт обработчик, закрывает меню и возвращает фокус на «⋯»', () => {
    const { onRename, btn, open } = setup();
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Переименовать' }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });
});
