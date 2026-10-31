// @vitest-environment jsdom
// «Сверка с YSQ» (QA 2026-10-26): брались первые шесть схем по порядку списка,
// а не по выраженности, остальные молча отрезались — «Самопожертвование
// + добавить?» стояло рядом с серыми 0% в таблице терапевта.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { crossCheckItems } from './ysqCrossCheck';
import { YsqCrossCheck } from './YsqCrossCheck';

afterEach(cleanup);

const latest = {
  id: 1, completedAt: '2026-10-25T10:00:00Z',
  scores: [
    { id: 'abandonment', pct5plus: 100, avg: 6, active: true },
    { id: 'self_sacrifice', pct5plus: 0, avg: 4, active: true },
    { id: 'unrelenting_standards', pct5plus: 57, avg: 4.1, active: true },
    { id: 'mistrust', pct5plus: 20, avg: 4.5, active: true },
  ],
};

describe('crossCheckItems', () => {
  it('по выраженности, как «Выраженные схемы» у клиента; пометка «в концептуализации»', () => {
    const items = crossCheckItems(['self_sacrifice', 'abandonment', 'unrelenting_standards', 'mistrust'], latest, ['abandonment']);
    expect(items.map(i => i.id)).toEqual(['abandonment', 'mistrust', 'unrelenting_standards', 'self_sacrifice']);
    expect(items.map(i => i.inConcept)).toEqual([true, false, false, false]);
    expect(items[3].valueLabel).toBe('4/6');
  });

  it('нет истории — порядок с сервера, ничего не теряется', () => {
    expect(crossCheckItems(['mistrust', 'failure'], undefined, []).map(i => i.id)).toEqual(['mistrust', 'failure']);
  });
});

describe('YsqCrossCheck', () => {
  const eight = ['abandonment', 'mistrust', 'failure', 'defectiveness', 'subjugation', 'self_sacrifice', 'entitlement', 'negativity'];

  it('больше шести — «Ещё N» раскрывает остальные, без молчаливой обрезки', () => {
    render(<YsqCrossCheck ysqActiveIds={eight} latest={undefined} conceptSchemaIds={[]} />);
    expect(screen.getAllByText('+ добавить?')).toHaveLength(6);
    fireEvent.click(screen.getByText('Ещё 2'));
    expect(screen.getAllByText('+ добавить?')).toHaveLength(8);
  });

  it('нет выраженных — блока нет', () => {
    const { container } = render(<YsqCrossCheck ysqActiveIds={[]} latest={latest} conceptSchemaIds={[]} />);
    expect(container.textContent).toBe('');
  });
});
