// @vitest-environment jsdom
// «В план» на плашке «Обычно в методе» схемы случая: хук с клиентом собирает заготовку рубрики и открывает лист
// выбора частей; пункт уходит в план этого клиента.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConceptGuideHint } from '../../../../../shared/src/therapy/conceptGraph/ConceptGuideHint';
import { FIXTURE_VIEW } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';
import type { UserId } from '../../../api';
import { useConceptGuide } from './useConceptGuide';

const h = vi.hoisted(() => ({ createPlanItems: vi.fn(), getTherapyClients: vi.fn(), trackEvent: vi.fn() }));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const MODE = { kind: 'mode', id: 'vulnerable_child' } as const;
function Harness({ clientId }: { clientId?: UserId }) {
  const guide = useConceptGuide(clientId == null ? {} : { plan: { clientId } });
  return <>
    <ConceptGuideHint view={FIXTURE_VIEW} from={MODE} actions={guide.actions} />
    {guide.sheets}
  </>;
}
const show = (clientId?: UserId) => render(<MemoryRouter><Harness clientId={clientId} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  h.createPlanItems.mockResolvedValue({ items: [] });
});

describe('useConceptGuide — «В план» с плашки', () => {
  it('«Между сессиями»: лист с названиями пунктов, пункт уходит клиенту со статьёй-источником', async () => {
    show(7 as UserId);
    fireEvent.click(screen.getByRole('button', { name: 'В план: Между сессиями' }));
    expect(screen.getByLabelText('Текст пункта')).toHaveProperty('value', 'Письмо себе. Встреча со своим маленьким Я');
    expect(h.getTherapyClients).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в план' }));
    await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith({
      clientIds: ['7'], rubric: 'between', text: 'Письмо себе. Встреча со своим маленьким Я',
      source: { kind: 'mode', id: 'vulnerable_child', field: 'betweenSessions' },
    }));
  });

  it('без `plan` кнопок «В план» на плашке нет', () => {
    show();
    expect(screen.queryByRole('button', { name: /^В план/ })).toBeNull();
  });
});
