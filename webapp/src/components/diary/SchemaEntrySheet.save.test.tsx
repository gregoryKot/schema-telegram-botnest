// @vitest-environment jsdom
// SchemaEntrySheet — сохранение. Регрессия: при отказе сервера лист закрывался
// молча (finally → goBack), и отказ был неотличим от успеха; Mode и Gratitude
// оставались и показывали ошибку. Плюс текст из «Дневника одной страницей».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEntrySheet } from './SchemaEntrySheet';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

const PLACEHOLDER = 'Например: на созвоне А. сказал, что мой ппт «слабо проработан»…';

function setup(onSave: ReturnType<typeof vi.fn>, props: { initialTrigger?: string } = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SchemaEntrySheet onClose={onClose} onSave={onSave} {...props} />
    </MemoryRouter>,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('SchemaEntrySheet — сохранение', () => {
  it('отказ сервера: лист не закрывается, видна ошибка, текст на месте, кнопка снова активна', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('500'));
    const { onClose } = setup(onSave);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Созвон с командой' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(screen.getByRole('alert').textContent).toMatch(/Не удалось сохранить/);
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Созвон с командой');
    expect((screen.getByText('Сохранить').closest('button') as HTMLButtonElement).disabled).toBe(false);
    expect(localStorage.getItem('diary_draft_schema')).toContain('Созвон с командой');
  });

  it('повтор после отказа: успех убирает ошибку и закрывает лист', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(undefined);
    const { onClose } = setup(onSave);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Созвон' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(screen.getByRole('alert')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('успех закрывает лист и стирает черновик', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { onClose } = setup(onSave);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Созвон' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem('diary_draft_schema')).toBeNull();
  });

  it('initialTrigger встаёт в поле ситуации и разрешает сохранить сразу', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    setup(onSave, { initialTrigger: 'Текст со страницы дневника' });
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Текст со страницы дневника');
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'Текст со страницы дневника' }));
  });
});
