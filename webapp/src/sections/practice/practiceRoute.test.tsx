// @vitest-environment jsdom
// «Практики» по состоянию маршрута: упражнение и «Мои планы» из общего поиска, карточка схемы из
// «О схеме» ({ openSchemaEx }). Цель исполняется один раз; незнакомое упражнение — ничего.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { practiceRouteState, practiceTargetOf, useRoutePractice } from './practiceRoute';

const open = { exercise: vi.fn(), schemaCard: vi.fn(), plans: vi.fn() };
function Screen() {
  useRoutePractice(open);
  return null;
}
const go = (state: unknown) => render(<MemoryRouter initialEntries={[{ pathname: '/practice', state }]}><Screen /></MemoryRouter>);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('состояние маршрута «Практик»', () => {
  it('упражнение, планы и карточка схемы зовут своё открытие по разу', async () => {
    go(practiceRouteState({ kind: 'exercise', id: 'safe' }));
    await waitFor(() => expect(open.exercise).toHaveBeenCalledWith('safe'));
    cleanup();
    go(practiceRouteState({ kind: 'plans' }));
    await waitFor(() => expect(open.plans).toHaveBeenCalledTimes(1));
    cleanup();
    go({ openSchemaEx: 'abandonment' });
    await waitFor(() => expect(open.schemaCard).toHaveBeenCalledWith('abandonment'));
    expect(open.exercise).toHaveBeenCalledTimes(1);
  });

  it('незнакомое упражнение и чужое состояние — не цель', () => {
    expect(practiceTargetOf({ practiceOpen: { kind: 'exercise', id: 'нет-такого' } })).toBeNull();
    expect(practiceTargetOf({ openPattern: { kind: 'schema', id: 'abandonment' } })).toBeNull();
    expect(practiceTargetOf(null)).toBeNull();
  });
});
