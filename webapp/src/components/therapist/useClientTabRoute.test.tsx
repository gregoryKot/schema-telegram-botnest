// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useClientTabRoute } from './useClientTabRoute';
import type { ClientTab } from './clientSheetTypes';

const client = { telegramId: '1', urlCode: 'abcdefgh' } as never;

function useBoth() {
  const [clientTab, setClientTab] = useState<ClientTab>('plan');
  useClientTabRoute({
    view: 'client', openClientRef: 'abcdefgh',
    detail: { selectedClient: client, clientTab, setClientTab }, board: { open: () => {} },
  });
  return { setClientTab, loc: useLocation() };
}
const wrap = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/cabinet/abcdefgh/plan?layout=phases']}>{children}</MemoryRouter>
);

describe('useClientTabRoute: раскладка плана', () => {
  it('?layout=phases переживает смену вкладки и возврат', () => {
    const { result } = renderHook(useBoth, { wrapper: wrap });
    act(() => result.current.setClientTab('concept'));
    expect(result.current.loc.pathname).toBe('/cabinet/abcdefgh/concept');
    expect(result.current.loc.search).toBe('?layout=phases');
    act(() => result.current.setClientTab('plan'));
    expect(result.current.loc.pathname).toBe('/cabinet/abcdefgh/plan');
    expect(result.current.loc.search).toBe('?layout=phases');
  });
});
