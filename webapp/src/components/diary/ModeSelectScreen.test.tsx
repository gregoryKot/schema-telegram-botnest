// @vitest-environment jsdom
// ModeSelectScreen (webapp) — шаг 1 дневника режимов после удаления окна-теста
// (ModeTestScreen, коммит 1f3de43): экран стал тонкой обвязкой над
// ModeFeelingBrowse + ModeGroupList (обе уже покрыты своими тестами), но сам
// экран остался без теста и просадил branches coverage-храповика webapp (CI,
// джоба webapp). Дефолт формы обращения — «ты» (AddressFormContext без
// провайдера), поэтому подпись ожидаем в форме «ты».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeSelectScreen } from './ModeSelectScreen';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(cleanup);

describe('ModeSelectScreen', () => {
  it('подпись «Что с тобой сейчас?» и чипы ModeFeelingBrowse видны сразу (главное действие)', () => {
    render(<ModeSelectScreen modeId="" onPick={vi.fn()} onBack={vi.fn()} />);
    expect(
      screen.getByText(
        'Что с тобой сейчас? Выбери самое близкое — потом уточним:',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Мне больно, страшно, одиноко/)).toBeTruthy();
  });

  it('«Знаю режим – выбрать из списка» открывает ModeGroupList и меняет подпись кнопки, повторный клик прячет', () => {
    render(<ModeSelectScreen modeId="" onPick={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByText('Детские режимы')).toBeNull();

    fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
    expect(screen.getByText('Скрыть список')).toBeTruthy();
    expect(screen.getByText('Детские режимы')).toBeTruthy();

    fireEvent.click(screen.getByText('Скрыть список'));
    expect(screen.getByText('Знаю режим – выбрать из списка')).toBeTruthy();
    expect(screen.queryByText('Детские режимы')).toBeNull();
  });

  it('клик по чипу семьи и режиму (ModeFeelingBrowse) вызывает onPick с верным modeId', () => {
    const onPick = vi.fn();
    render(<ModeSelectScreen modeId="" onPick={onPick} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });

  it('уже выбранный modeId помечен в открытом ModeGroupList (is-selected)', () => {
    const { container } = render(
      <ModeSelectScreen
        modeId="vulnerable_child"
        onPick={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
    const selected = screen
      .getByText('Уязвимый Ребёнок')
      .closest('.mode-card');
    expect(selected?.className).toContain('is-selected');
    // и остальные карточки такого класса не несут (ветка «не выбран»)
    const others = container.querySelectorAll(
      '.mode-card:not(.is-selected)',
    );
    expect(others.length).toBeGreaterThan(0);
  });
});
