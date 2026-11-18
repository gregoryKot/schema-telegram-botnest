// @vitest-environment jsdom
// «Паттерны» по состоянию маршрута из общего поиска: открывается экран паттерна схемы или режима —
// один раз, состояние очищается; чужое состояние и незнакомый id ничего не открывают.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { patternRouteState, patternTargetOf, useRoutedPatternLayer } from './patternRoute';

vi.mock('../../api', () => ({ api: {} }));
vi.mock('./usePatternEntries', () => ({ usePatternEntries: () => ({ schemaEntries: [], modeEntries: [], ready: true }) }));
vi.mock('../../../../shared/src/pattern/usePatternStatus', () => ({
  usePatternStatus: () => ({ items: [], loading: false, failed: false, reload: vi.fn(), statusFor: vi.fn() }),
}));
vi.mock('../../components/patternSheet/PatternSheet', () => ({
  PatternSheet: ({ kind, id }: { kind: string; id: string }) => <div data-testid="pattern-sheet">{kind}:{id}</div>,
}));

function Screen() {
  const pat = useRoutedPatternLayer();
  const { state } = useLocation();
  return <>{pat.layer}<output data-testid="state">{JSON.stringify(state)}</output></>;
}
const open = (state: unknown) => render(<MemoryRouter initialEntries={[{ pathname: '/schemas', state }]}><Screen /></MemoryRouter>);

afterEach(cleanup);

describe('состояние маршрута → экран паттерна', () => {
  it('схема и режим открываются своим экраном; состояние очищено', async () => {
    open(patternRouteState({ kind: 'schema', id: 'abandonment' }));
    expect((await screen.findByTestId('pattern-sheet')).textContent).toBe('schema:abandonment');
    expect(screen.getByTestId('state').textContent).toBe('null');
    cleanup();
    open(patternRouteState({ kind: 'mode', id: 'vulnerable_child' }));
    expect((await screen.findByTestId('pattern-sheet')).textContent).toBe('mode:vulnerable_child');
  });

  it('без состояния, с чужим состоянием и с незнакомым id экран не открывается', () => {
    open({ guideSheet: { kind: 'schema', id: 'abandonment' } });
    expect(screen.queryByTestId('pattern-sheet')).toBeNull();
    expect(patternTargetOf(null)).toBeNull();
    expect(patternTargetOf({ openPattern: { kind: 'schema', id: 'нет-такой' } })).toBeNull();
    expect(patternTargetOf({ openPattern: { kind: 'need', id: 'abandonment' } })).toBeNull();
  });
});
