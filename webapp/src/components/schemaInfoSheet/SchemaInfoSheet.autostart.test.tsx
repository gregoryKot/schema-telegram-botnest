// @vitest-environment jsdom
// Справочник, открытый сразу на тесте (autoStartTest: «Ещё» → «Тест на схемы», задание терапевта), и переход
// «Читать карточку схемы» из результата. Стенд b16 (diary-library-highlight): тест вставал в одном коммите со
// справочником, оба листа писали запись истории от одного location, и переход закрывал оба листа — человек
// оказывался в «Ещё» вместо схемы. Теперь тест встаёт следующим коммитом; здесь — связка «результат →
// справочник на вкладке «Схемы» с поднятой схемой» и то, что справочник при этом остаётся открытым.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaInfoSheet } from '../SchemaInfoSheet';
import { useHistorySheet } from '../../hooks/useHistorySheet';

vi.mock('../YSQTestSheet', () => ({
  YSQTestSheet: ({ onClose, onViewSchemas }: { onClose: () => void; onViewSchemas?: (n: string) => void }) => {
    const goBack = useHistorySheet(onClose);
    return <button onClick={() => goBack(() => onViewSchemas?.('Покинутость / Нестабильность'))}>Читать карточку схемы</button>;
  },
}));

function Host() {
  const [open, setOpen] = useState(true);
  return open ? <SchemaInfoSheet onClose={() => setOpen(false)} autoStartTest /> : <div>HOST-CLOSED</div>;
}

afterEach(() => cleanup());

describe('SchemaInfoSheet autoStartTest → «Читать карточку схемы»', () => {
  it('тест открывается сам, а переход из результата оставляет справочник на нужной схеме', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<MemoryRouter initialEntries={['/more']}><Host /></MemoryRouter>);
    const read = await screen.findByText('Читать карточку схемы');
    await act(() => new Promise((r) => setTimeout(r, 20))); // запись истории листа теста дошла
    fireEvent.click(read);
    await waitFor(() => expect(screen.queryByText('Читать карточку схемы')).toBeNull());
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    const tile = await screen.findByText('Покинутость / Нестабильность');
    expect(tile.closest('.cs-tile')?.getAttribute('aria-current')).toBe('true');
    expect(scrolled).toHaveBeenCalledTimes(1);
  });
});
