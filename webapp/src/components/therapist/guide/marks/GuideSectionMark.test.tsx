// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { listAddresses } from '../../../../../../shared/src/schemaTherapy/guide';
import { GuideSection } from '../GuideSection';
import { GuideMarkContext } from './GuideSectionMark';
import { useClientGuideMarks, type GuideMarkClient } from './useClientGuideMarks';
import { useGuideMarking } from './useGuideMarking';

const h = vi.hoisted(() => ({
  getGuideMarks: vi.fn(),
  getGuideMarkClients: vi.fn(),
  saveGuideMark: vi.fn(),
  deleteGuideMark: vi.fn(),
  getTherapyClients: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const ADDRESS = listAddresses('schema').find((a) => a.endsWith('/inSession'))!;
const COPING = listAddresses('schema').find((a) => a.includes('/coping.'))!;
const ANNA: GuideMarkClient = { id: 11, name: 'Анна' };
const saved = (note: string | null = null) => ({
  id: 5, clientId: '11', address: ADDRESS, note, snapshot: 'текст', createdAt: '', updatedAt: '',
});

function Harness({ client, address = ADDRESS }: { client?: GuideMarkClient; address?: string }) {
  const marking = useGuideMarking(useClientGuideMarks(client));
  return (
    <MemoryRouter>
      <GuideMarkContext.Provider value={marking.ctx}>
        <GuideSection title="В кабинете" text="Текст раздела" address={address} />
      </GuideMarkContext.Provider>
      {marking.node}
    </MemoryRouter>
  );
}
const title = () => screen.getByRole('button', { name: 'В кабинете' });

beforeEach(() => {
  vi.clearAllMocks();
  h.getGuideMarks.mockResolvedValue({ marks: [] });
  h.getGuideMarkClients.mockResolvedValue({ clientIds: ['12'] });
  h.saveGuideMark.mockResolvedValue({ mark: saved(), created: true });
  h.deleteGuideMark.mockResolvedValue(undefined);
  h.getTherapyClients.mockResolvedValue([
    { telegramId: 11, name: 'Анна', clientAlias: null },
    { telegramId: 12, name: 'Борис', clientAlias: null },
  ]);
});

describe('«Про клиента» у раздела справочника', () => {
  it('без провайдера и у копинга схемы раздел — просто текст, без кнопки', () => {
    const { unmount } = render(<GuideSection title="В кабинете" text="Текст" address={ADDRESS} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(<Harness address={COPING} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('тап по тексту подсвечивает раздел и даёт «Про клиента»; повторный тап снимает подсветку', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Текст раздела'));
    expect(title().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Про клиента' })).toBeTruthy();
    fireEvent.click(screen.getByText('Текст раздела'));
    expect(title().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Про клиента' })).toBeNull();
  });

  it('общий справочник: выбор клиента с пометкой «уже отмечено», отметка уходит выбранному с тостом', async () => {
    render(<Harness />);
    fireEvent.click(title());
    fireEvent.click(await screen.findByRole('button', { name: 'Про клиента' }));
    const boris = await screen.findByRole('button', { name: /Борис/ });
    expect(boris.textContent).toContain('уже отмечено');
    expect(screen.getByRole('button', { name: /Анна/ }).textContent).not.toContain('уже отмечено');
    fireEvent.click(screen.getByRole('button', { name: /Анна/ }));
    fireEvent.change(screen.getByLabelText('Как это у клиента'), { target: { value: 'про маму' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отметить' }));
    expect(await screen.findByText('Отмечено у Анна')).toBeTruthy();
    expect(h.saveGuideMark).toHaveBeenCalledWith(11, expect.objectContaining({ address: ADDRESS, note: 'про маму' }));
    expect(h.saveGuideMark.mock.calls[0][1].snapshot).toBeTruthy();
  });

  it('уже отмеченный клиент открывает свою запись для правки, а не новую', async () => {
    h.getGuideMarks.mockResolvedValue({ marks: [{ ...saved('было'), clientId: '12' }] });
    render(<Harness />);
    fireEvent.click(title());
    fireEvent.click(await screen.findByRole('button', { name: 'Про клиента' }));
    fireEvent.click(await screen.findByRole('button', { name: /Борис/ }));
    expect(((await screen.findByLabelText('Как это у клиента')) as HTMLTextAreaElement).value).toBe('было');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeTruthy();
  });

  it('из карточки клиента: отмеченный раздел подсвечен с именем, повторный тап → «Снять отметку»', async () => {
    h.getGuideMarks.mockResolvedValue({ marks: [saved()] });
    render(<Harness client={ANNA} />);
    expect(await screen.findByText('Отмечено: Анна')).toBeTruthy();
    fireEvent.click(title());
    fireEvent.click(screen.getByRole('button', { name: 'Снять отметку' }));
    expect(h.deleteGuideMark).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText('Отмечено: Анна')).toBeNull());
  });

  it('ошибка сохранения — тост и откат подсветки', async () => {
    h.saveGuideMark.mockRejectedValue(new Error('500'));
    render(<Harness client={ANNA} />);
    await waitFor(() => expect(h.getGuideMarks).toHaveBeenCalled());
    fireEvent.click(title());
    fireEvent.click(screen.getByRole('button', { name: 'Про клиента' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Отметить' }));
    expect(await screen.findByText('Не удалось сохранить отметку')).toBeTruthy();
    expect(screen.queryByText('Отмечено: Анна')).toBeNull();
  });
});
