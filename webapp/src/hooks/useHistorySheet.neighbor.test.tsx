// @vitest-environment jsdom
// «Закрыть свой лист и открыть соседний» — goBack(then) (docs/open/one-frontend.md).
// Прежний порядок `onOpenNeighbor(); goBack()` в одном такте терял запись
// соседа в Chromium на createBrowserRouter: сосед на экране, записи под ним
// нет, следующее «Назад» уходило со страницы. Теперь сосед открывается после
// onClose, когда снятие записи дошло до истории. Хосты настоящие — листы
// размонтируются по onClose.
import { describe, it, expect, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useHistorySheet } from './useHistorySheet';
import { sheetStackOf } from './historySheetStack';

afterEach(() => cleanup());

const nav: { back: () => void; depth: () => number } = { back: () => {}, depth: () => 0 };
function Spy() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    nav.back = () => navigate(-1);
    nav.depth = () => sheetStackOf(location.state).length;
  });
  return null;
}

function Sheet({ name, onClose, onNeighbor }: { name: string; onClose: () => void; onNeighbor?: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <div>
      <span>{name}</span>
      <button onClick={goBack}>Закрыть {name}</button>
      {onNeighbor && <button onClick={() => goBack(onNeighbor)}>К соседу</button>}
    </div>
  );
}

function Host({ log }: { log: string[] }) {
  const [open, setOpen] = useState<'history' | 'tracker' | null>('history');
  if (open === 'history') {
    return (
      <Sheet
        key="history"
        name="ИСТОРИЯ"
        onClose={() => { log.push('close-history'); setOpen(null); }}
        onNeighbor={() => { log.push('open-tracker'); setOpen('tracker'); }}
      />
    );
  }
  // key — разные листы, как в приложении (иначе React переиспользует инстанс).
  if (open === 'tracker') return <Sheet key="tracker" name="ТРЕКЕР" onClose={() => setOpen(null)} />;
  return <div>ПУСТО</div>;
}

describe('useHistorySheet — goBack(then): соседний лист после закрытия своего', () => {
  it('then идёт после onClose, у соседа своя запись, «Назад» закрывает соседа', () => {
    const log: string[] = [];
    render(<MemoryRouter><Spy /><Host log={log} /></MemoryRouter>);
    expect(nav.depth()).toBe(1);

    fireEvent.click(screen.getByText('К соседу'));
    expect(log).toEqual(['close-history', 'open-tracker']);
    expect(screen.getByText('ТРЕКЕР')).toBeTruthy();
    expect(nav.depth()).toBe(1); // запись соседа, а не брошенная запись истории

    act(() => nav.back());
    expect(screen.getByText('ПУСТО')).toBeTruthy();
    expect(nav.depth()).toBe(0);
  });

  it('onClick={goBack} передаёт событие — оно не принимается за then', () => {
    const log: string[] = [];
    render(<MemoryRouter><Spy /><Host log={log} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Закрыть ИСТОРИЯ'));
    expect(log).toEqual(['close-history']);
    expect(screen.getByText('ПУСТО')).toBeTruthy();
  });

  it('then срабатывает один раз, даже если лист не размонтировался', () => {
    let opened = 0;
    function Stay() {
      return <Sheet name="ЛИСТ" onClose={() => {}} onNeighbor={() => { opened += 1; }} />;
    }
    render(<MemoryRouter><Spy /><Stay /></MemoryRouter>);
    fireEvent.click(screen.getByText('К соседу'));
    act(() => nav.back()); // ещё одна смена адреса при уже снятой записи
    expect(opened).toBe(1);
  });
});
