// @vitest-environment jsdom
// ModeDoubtButton (webapp) — «Сомневаешься? Сравни с похожими» на карточке
// выбранного режима: кнопка видна, тап открывает лист с парами (fixed-оверлей
// с useHistorySheet), «Это ближе» переключает выбор и шлёт mode_doubt_switched,
// открытие шлёт mode_doubt_opened. Зеркало schema-miniapp ModeDoubtButton.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderButton(modeId: string, onSwitch = vi.fn()) {
  return {
    onSwitch,
    ...render(
      <MemoryRouter>
        <ModeDoubtButton modeId={modeId} onSwitch={onSwitch} />
      </MemoryRouter>,
    ),
  };
}

describe('ModeDoubtButton (webapp)', () => {
  it('кнопка «Сомневаешься? Сравни с похожими» видна при выбранном режиме', () => {
    renderButton('vulnerable_child');
    expect(
      screen.getByText('Сомневаешься? Сравни с похожими'),
    ).toBeTruthy();
  });

  it('режим без пар в реестре — кнопка не рендерится (защита)', () => {
    const { container } = renderButton('not_a_real_mode');
    expect(container.textContent).toBe('');
  });

  it('тап открывает лист с парами выбранного режима и шлёт mode_doubt_opened', () => {
    renderButton('vulnerable_child');
    fireEvent.click(screen.getByText('Сомневаешься? Сравни с похожими'));
    expect(screen.getByText(/С чем путают Уязвимый Ребёнок/)).toBeTruthy();
    // Имя соседа встречается и в заголовке пары, и внутри текста gist —
    // проверяем по уникальной строке check, чтобы не поймать оба совпадения.
    expect(
      screen.getByText(/Спросить себя, чего хочется: чтобы обняли/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Посмотреть на мысли: образы боли и одиночества/),
    ).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_DOUBT_OPENED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });

  it('«Это ближе» вызывает onSwitch с otherId, шлёт mode_doubt_switched и закрывает лист', () => {
    const onSwitch = vi.fn();
    renderButton('vulnerable_child', onSwitch);
    fireEvent.click(screen.getByText('Сомневаешься? Сравни с похожими'));
    const [firstCloser] = screen.getAllByText('Это ближе');
    fireEvent.click(firstCloser);
    expect(onSwitch).toHaveBeenCalledWith('helpless_surrenderer');
    expect(mockApi.trackEvent).toHaveBeenCalledWith(
      MODE_DOUBT_SWITCHED_EVENT,
      { from: 'vulnerable_child', to: 'helpless_surrenderer' },
    );
    expect(screen.queryByText(/С чем путают/)).toBeNull();
  });
});
