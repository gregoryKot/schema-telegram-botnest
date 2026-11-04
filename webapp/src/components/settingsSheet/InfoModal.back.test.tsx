// @vitest-environment jsdom
// C-З2 (QA 2026-11): «Назад» над вложенным окном листа настроек закрывает
// только окно. До правки InfoModal не клал запись в историю: «Назад» уводил
// с самого листа.
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { InfoModal } from './ui';

let nav: ReturnType<typeof useNavigate> | null = null;
let depth = 0;
function Host() {
  const [open, setOpen] = useState(true);
  nav = useNavigate();
  depth = (useLocation().state as { __sheetStack?: string[] } | null)?.__sheetStack?.length ?? 0;
  return <div>{open && <InfoModal onClose={() => setOpen(false)}><p>Сводка</p></InfoModal>}<span>под окном</span></div>;
}

describe('InfoModal и «Назад»', () => {
  it('запись истории есть, «Назад» закрывает окно', async () => {
    render(<MemoryRouter initialEntries={['/', '/s']} initialIndex={1}><Host /></MemoryRouter>);
    expect(await screen.findByText('Сводка')).toBeTruthy();
    expect(depth).toBe(1);
    act(() => nav!(-1));
    expect(screen.queryByText('Сводка')).toBeNull();
    expect(screen.getByText('под окном')).toBeTruthy();
  });

  it('кнопка «Закрыть» снимает запись истории', async () => {
    render(<MemoryRouter initialEntries={['/s']}><Host /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Закрыть'));
    await screen.findByText('под окном');
    expect(screen.queryByText('Сводка')).toBeNull();
    expect(depth).toBe(0);
  });
});
