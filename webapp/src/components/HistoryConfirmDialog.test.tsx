// @vitest-environment jsdom
// T-3 (QA 2026-11): «Назад» на «Удалить задание?» / «Удалить заметку?» уводил
// из карточки клиента. Диалог кладёт запись в историю: «Назад» закрывает
// только его. Вид `run` держит диалог открытым, пока идёт действие.
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { HistoryConfirmDialog } from './HistoryConfirmDialog';

// Снимок роутера: мутация свойства в эффекте, а не переприсваивание внешней переменной.
const snap = { nav: null as ReturnType<typeof useNavigate> | null, depth: 0 };

function Host({ run }: { run?: () => Promise<boolean> }) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const depth = (useLocation().state as { __sheetStack?: string[] } | null)?.__sheetStack?.length ?? 0;
  useEffect(() => { snap.nav = navigate; snap.depth = depth; });
  return (
    <div>
      {open && (run
        ? <HistoryConfirmDialog title="Удалить?" message="м" confirmLabel="Да" run={run} error="сбой" onCancel={() => setOpen(false)} />
        : <HistoryConfirmDialog title="Удалить?" message="м" confirmLabel="Да" onConfirm={() => {}} onCancel={() => setOpen(false)} />)}
    </div>
  );
}

const mount = (run?: () => Promise<boolean>) =>
  render(<MemoryRouter initialEntries={['/', '/cabinet/7']} initialIndex={1}><Host run={run} /></MemoryRouter>);

describe('HistoryConfirmDialog', () => {
  it('«Назад» закрывает диалог, запись истории была', async () => {
    mount();
    await screen.findByText('Удалить?');
    expect(snap.depth).toBe(1);
    act(() => snap.nav!(-1));
    expect(screen.queryByText('Удалить?')).toBeNull();
  });

  it('run: ответ true — диалог закрыт и запись снята', async () => {
    const run = vi.fn().mockResolvedValue(true);
    mount(run);
    fireEvent.click(await screen.findByText('Да'));
    await waitFor(() => expect(screen.queryByText('Удалить?')).toBeNull());
    expect(run).toHaveBeenCalledTimes(1);
    expect(snap.depth).toBe(0);
  });

  it('run: ответ false — диалог остаётся с ошибкой, запись не снята', async () => {
    const run = vi.fn().mockResolvedValue(false);
    mount(run);
    fireEvent.click(await screen.findByText('Да'));
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(screen.getByText('Удалить?')).toBeTruthy();
    expect(screen.getByText('сбой')).toBeTruthy();
    expect(snap.depth).toBe(1);
  });

  it('run: пока действие идёт, кнопки заняты', async () => {
    let done: (ok: boolean) => void = () => {};
    mount(() => new Promise<boolean>(r => { done = r; }));
    fireEvent.click(await screen.findByText('Да'));
    expect((screen.getByText('Отмена') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { done(true); });
  });
});
