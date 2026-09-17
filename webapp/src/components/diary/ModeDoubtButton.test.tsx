// @vitest-environment jsdom
// ModeDoubtButton (webapp) — «Сомневаешься? Сравни с похожими» на карточке
// выбранного режима: кнопка видна, тап открывает лист с парами (fixed-оверлей
// с useHistorySheet), «Это ближе» переключает выбор и шлёт mode_doubt_switched,
// открытие шлёт mode_doubt_opened. Зеркало schema-miniapp ModeDoubtButton.test.tsx.
//
// Редизайн 2026-08-04 (жалоба владельца — из листа непонятно как выйти,
// карточки вели клиническим термином): «← Назад» явно закрывает лист, якорь
// «сейчас выбран», заголовок карточки — человеческая фраза соседа
// (getModeLeafLabel), термин — пометкой «→ {имя}», нижняя «Оставляю: {режим}»
// закрывает без переключения и без аналитики.
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

function openSheet(modeId = 'vulnerable_child', onSwitch = vi.fn()) {
  renderButton(modeId, onSwitch);
  fireEvent.click(screen.getByText('Сомневаешься? Сравни с похожими'));
  return onSwitch;
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
    openSheet();
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_DOUBT_OPENED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });

  it('лист показывает «← Назад», и он закрывает лист', () => {
    openSheet();
    expect(screen.getByText('сейчас выбран')).toBeTruthy();
    const back = screen.getByText('Назад');
    fireEvent.click(back);
    expect(screen.queryByText('сейчас выбран')).toBeNull();
  });

  it('якорь показывает «сейчас выбран» с именем текущего режима', () => {
    openSheet();
    const label = screen.getByText('сейчас выбран');
    expect(label).toBeTruthy();
    expect(label.previousSibling?.textContent).toMatch(/Уязвимый Ребёнок/);
  });

  it('заголовок карточки — человеческая фраза соседа, термин — пометкой', () => {
    openSheet();
    // Заголовки — фразы-label из MODE_PICKER_GROUPS, а не клинические имена.
    expect(
      screen.getByText('Опускаются руки, пусть решат за меня'),
    ).toBeTruthy();
    expect(
      screen.getByText('Прокручиваю худшее снова и снова'),
    ).toBeTruthy();
    // Термин — пометкой «→ имя», не заголовком.
    expect(screen.getByText('→ Беспомощный Капитулянт')).toBeTruthy();
    expect(screen.getByText('→ Беспокоящийся Гиперконтролёр')).toBeTruthy();
    // Уникальные строки проверки — чтобы не поймать совпадения с заголовком.
    expect(
      screen.getByText(/Спросить себя, чего хочется: чтобы обняли/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Посмотреть на мысли: образы боли и одиночества/),
    ).toBeTruthy();
  });

  it('«Это ближе» вызывает onSwitch с otherId, шлёт mode_doubt_switched и закрывает лист', () => {
    const onSwitch = openSheet();
    const [firstCloser] = screen.getAllByText('Это ближе');
    fireEvent.click(firstCloser);
    expect(onSwitch).toHaveBeenCalledWith('helpless_surrenderer');
    expect(mockApi.trackEvent).toHaveBeenCalledWith(
      MODE_DOUBT_SWITCHED_EVENT,
      { from: 'vulnerable_child', to: 'helpless_surrenderer' },
    );
    expect(screen.queryByText('сейчас выбран')).toBeNull();
  });

  it('нижняя «Оставляю» закрывает лист без onSwitch и без mode_doubt_switched', () => {
    const onSwitch = openSheet();
    const closeBtn = screen.getByText(/Оставляю: .*Уязвимый Ребёнок/);
    fireEvent.click(closeBtn);
    expect(onSwitch).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      MODE_DOUBT_SWITCHED_EVENT,
      expect.anything(),
    );
    expect(screen.queryByText('сейчас выбран')).toBeNull();
  });
});
