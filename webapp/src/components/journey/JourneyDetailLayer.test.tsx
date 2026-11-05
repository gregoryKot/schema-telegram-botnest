// @vitest-environment jsdom
// C-З2 (QA 2026-11): открытая запись «Моего пути» — уровень истории; «Назад»
// закрывает запись, лист остаётся. До правки запись была локальным состоянием.
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useRef } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { JourneyDetailLayer } from './JourneyDetailLayer';

vi.mock('../../../../shared/src/journey/JourneyDetailPane', () => ({
  JourneyDetailPane: ({ detail }: { detail: { close: () => void } }) => (
    <button onClick={detail.close}>закрыть запись</button>
  ),
}));

const snap = { nav: null as ReturnType<typeof useNavigate> | null, depth: 0, closeOutside: null as (() => void) | null };
const noop = () => {};

function Host({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const depth = (useLocation().state as { __sheetStack?: string[] } | null)?.__sheetStack?.length ?? 0;
  const ref = useRef<() => void>(noop);
  useEffect(() => { snap.nav = navigate; snap.depth = depth; snap.closeOutside = () => ref.current(); });
  const detail = { item: { id: 1 }, parts: null, loading: false, open: noop, close: onClose };
  return (
    <JourneyDetailLayer
      closeRef={ref}
      detail={detail as never}
      subtitle={() => null}
      tr={(ty) => ty}
      onShare={noop}
      del={{} as never}
    />
  );
}

describe('JourneyDetailLayer', () => {
  it('пока запись открыта, в истории лежит её запись; «Назад» зовёт close', () => {
    const onClose = vi.fn();
    render(<MemoryRouter initialEntries={['/', '/more']} initialIndex={1}><Host onClose={onClose} /></MemoryRouter>);
    expect(snap.depth).toBe(1);
    act(() => snap.nav!(-1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('закрытие снаружи (после удаления) снимает запись и зовёт close', () => {
    const onClose = vi.fn();
    render(<MemoryRouter initialEntries={['/more']}><Host onClose={onClose} /></MemoryRouter>);
    act(() => snap.closeOutside!());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(snap.depth).toBe(0);
  });
});
