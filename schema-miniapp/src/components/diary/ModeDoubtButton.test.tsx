// @vitest-environment jsdom
// ModeDoubtButton — «Сомневаешься? Сравни с похожими» на карточке выбранного
// режима: кнопка видна при выбранном режиме, тап открывает лист с парами
// (shared/mode/modeDoubts), «Это ближе» переключает выбор и шлёт
// mode_doubt_switched, открытие листа шлёт mode_doubt_opened.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeDoubtButton } from './ModeDoubtButton';
import {
  MODE_DOUBT_OPENED_EVENT,
  MODE_DOUBT_SWITCHED_EVENT,
} from '../../../../shared/src/share/analytics';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('ModeDoubtButton', () => {
  it('кнопка «Сомневаешься? Сравни с похожими» видна при выбранном режиме', () => {
    render(<ModeDoubtButton modeId="vulnerable_child" onSwitch={vi.fn()} />);
    expect(screen.getByText('Сомневаешься? Сравни с похожими')).toBeTruthy();
  });

  it('режим без пар в реестре — кнопка не рендерится (защита)', () => {
    const { container } = render(
      <ModeDoubtButton modeId="not_a_real_mode" onSwitch={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('тап открывает лист с парами выбранного режима и шлёт mode_doubt_opened', () => {
    render(<ModeDoubtButton modeId="vulnerable_child" onSwitch={vi.fn()} />);
    fireEvent.click(screen.getByText('Сомневаешься? Сравни с похожими'));
    expect(screen.getByText(/С чем путают Уязвимый Ребёнок/)).toBeTruthy();
    expect(screen.getByText('Беспомощный Капитулянт')).toBeTruthy();
    expect(screen.getByText('Беспокоящийся Гиперконтролёр')).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_DOUBT_OPENED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });

  it('«Это ближе» вызывает onSwitch с otherId, шлёт mode_doubt_switched и закрывает лист', () => {
    const onSwitch = vi.fn();
    render(<ModeDoubtButton modeId="vulnerable_child" onSwitch={onSwitch} />);
    fireEvent.click(screen.getByText('Сомневаешься? Сравни с похожими'));
    const [firstCloser] = screen.getAllByText('Это ближе');
    fireEvent.click(firstCloser);
    expect(onSwitch).toHaveBeenCalledWith('helpless_surrenderer');
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_DOUBT_SWITCHED_EVENT, {
      from: 'vulnerable_child',
      to: 'helpless_surrenderer',
    });
    expect(screen.queryByText(/С чем путают/)).toBeNull();
  });
});
