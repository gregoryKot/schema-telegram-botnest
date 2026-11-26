// @vitest-environment jsdom
// Знаки строк «Ещё» (b24): один знак — одна строка, у каждой строки знак есть — и у клиента, и у терапевта.
// Сверяется сам рисунок (svg в .pp-row-art), а не имя компонента: два ключа с одним мотивом — тоже повтор.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MoreRows } from './MoreRows';
import { useMoreRows, type MoreRowsDeps } from './useMoreRows';

vi.mock('../tasks/newTasks', () => ({ useNewTasksCount: () => 0 }));
vi.mock('../../components/therapy/trackTherapyNudge', () => ({ trackTherapyNudge: vi.fn() }));

const deps = (userRole: MoreRowsDeps['userRole']): MoreRowsDeps => ({
  onNavigate: vi.fn(), onOpenSchema: vi.fn(), onOpenAdvanced: vi.fn(), onOpenWhy: vi.fn(), onOpenJourney: vi.fn(),
  onOpenTasks: vi.fn(), onOpenSelfMap: vi.fn(), userRole, onOpenTherapistCabinet: vi.fn(),
});
function List({ userRole }: { userRole: MoreRowsDeps['userRole'] }) {
  return <MoreRows rows={useMoreRows(deps(userRole)).rows} />;
}
const drawings = (userRole: MoreRowsDeps['userRole']) => {
  const { container } = render(<MemoryRouter><List userRole={userRole} /></MemoryRouter>);
  return [...container.querySelectorAll('.ds-list-row')].map((r) => ({
    title: r.querySelector('.ds-list-title')!.textContent!,
    svg: r.querySelector('.pp-row-art svg')?.innerHTML ?? null,
  }));
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('знаки строк «Ещё»', () => {
  it.each([
    ['клиент', 'CLIENT', 'Поговорить с кем-то'],
    ['терапевт', 'THERAPIST', 'Кабинет терапевта'],
  ] as const)('%s: у каждой строки свой знак, повторов нет', (_n, role, own) => {
    if (role === 'THERAPIST') localStorage.setItem('therapist_mode', '1');
    const rows = drawings(role);
    expect(rows.map((r) => r.title)).toContain(own);
    expect(rows.filter((r) => !r.svg).map((r) => r.title)).toEqual([]);
    expect(new Set(rows.map((r) => r.svg)).size).toBe(rows.length);
  });

  it('клиент со своим терапевтом: строка связи — тот же один знак разговора', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const rows = drawings('CLIENT');
    expect(new Set(rows.map((r) => r.svg)).size).toBe(rows.length);
  });
});
