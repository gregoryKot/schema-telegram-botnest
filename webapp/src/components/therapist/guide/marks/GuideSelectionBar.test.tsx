// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { listAddresses } from '../../../../../../shared/src/schemaTherapy/guide';
import { GuideSection } from '../GuideSection';
import { GuideMarkContext } from './GuideSectionMark';
import { GuideSelectionBar } from './GuideSelectionBar';
import { useGuideMarking } from './useGuideMarking';
import { useRef } from 'react';

const h = vi.hoisted(() => ({
  getGuideMarks: vi.fn(), getGuideMarkClients: vi.fn(), saveGuideMark: vi.fn(), deleteGuideMark: vi.fn(),
  getTherapyClients: vi.fn(), trackEvent: vi.fn(),
}));
vi.mock('../../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const ADDRESS = listAddresses('schema').find((a) => a.endsWith('/inSession'))!;

function Harness() {
  const marking = useGuideMarking();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <MemoryRouter>
      <GuideMarkContext.Provider value={marking.ctx}>
        <GuideSelectionBar pageRef={ref} />
        <div className="gd-page" ref={ref}>
          <GuideSection title="В кабинете" text="Первая фраза. Вторая фраза." address={ADDRESS} />
        </div>
      </GuideMarkContext.Provider>
      {marking.node}
    </MemoryRouter>
  );
}

function selectText(word: string) {
  const node = screen.getByText('Первая фраза. Вторая фраза.').firstChild!;
  const start = node.textContent!.indexOf(word);
  const r = document.createRange();
  r.setStart(node, start);
  r.setEnd(node, start + word.length);
  const s = window.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
  act(() => { document.dispatchEvent(new Event('selectionchange')); });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.getSelection()?.removeAllRanges();
  h.getGuideMarks.mockResolvedValue({ marks: [] });
  h.getGuideMarkClients.mockResolvedValue({ clientIds: [] });
  h.saveGuideMark.mockResolvedValue({ mark: { id: 1, clientId: '11', address: ADDRESS, note: null, snapshot: 'Вторая фраза.', fragment: true, createdAt: '', updatedAt: '' }, created: true });
  h.getTherapyClients.mockResolvedValue([{ telegramId: 11, name: 'Анна', clientAlias: null }]);
});

describe('«Про клиента» для выделенного текста', () => {
  it('нет выделения — нет кнопки', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Про клиента' })).toBeNull();
  });

  it('выделил → кнопка → клиент и заметка → в карточку уходит именно выделенный текст с адресом раздела', async () => {
    render(<Harness />);
    selectText('Вторая фраза.');
    const bar = await screen.findByRole('button', { name: 'Про клиента' });
    expect(fireEvent.mouseDown(bar)).toBe(false); // выделение не отбирается
    fireEvent.click(bar);
    expect(screen.getByText('Выделенный текст ляжет', { exact: false })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }));
    fireEvent.change(await screen.findByLabelText('Как это у клиента'), { target: { value: 'про маму' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отметить' }));
    expect(await screen.findByText('Отмечено у Анна')).toBeTruthy();
    expect(h.saveGuideMark).toHaveBeenCalledWith(11, { address: ADDRESS, snapshot: 'Вторая фраза.', note: 'про маму', fragment: true });
    expect(h.getGuideMarkClients).not.toHaveBeenCalled();
  });
});
