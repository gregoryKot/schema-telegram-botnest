// @vitest-environment jsdom
// JourneySheet — обёртка «Мой путь» вокруг общих useJourney/JourneyView
// (0% покрытия). Логика самой ленты уже покрыта тестами shared/, здесь
// мокаем shared-хуки/компоненты и проверяем оркестрацию webapp-обёртки:
// переключение список↔деталь, видимость кнопки «Поделиться» (total>0),
// проброс шаринга и рендер шита шаринга при наличии payload.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JourneySheet } from './JourneySheet';
import { WEB_JOURNEY_KIT } from './journey/webJourneyKit';

// Какой набор героев сверять: подставляется тестом после импорта обёртки.
const KIT_PROBE: { value: unknown } = { value: null };
const shareFeed = vi.fn();
const shareSummary = vi.fn();
const shareItem = vi.fn();
const closeShare = vi.fn();
const openDetail = vi.fn();
let mockDetailItem: unknown = null;
let mockTotal = 0;
let mockPayload: Record<string, unknown> | null = null;

vi.mock('../../../shared/src/journey/useJourney', () => ({
  useJourney: () => ({ items: [], stats: [], total: mockTotal, period: 'all' }),
  makeJourneyProps: () => ({ deps: {}, subtitle: () => '', fetchResult: vi.fn(), fetchDetail: vi.fn() }),
}));
vi.mock('../../../shared/src/journey/journeyShare', () => ({
  useJourneyShare: () => ({ payload: mockPayload, close: closeShare, shareFeed, shareSummary, shareItem }),
}));
vi.mock('../../../shared/src/journey/JourneyView', () => ({
  JourneyView: ({
    onShareFeed,
    kit,
  }: {
    onShareFeed: () => void;
    kit: unknown;
  }) => (
    <div>
      Лента пути
      <span data-testid="journey-kit">{String(kit === KIT_PROBE.value)}</span>
      <button onClick={onShareFeed}>Поделиться лентой</button>
    </div>
  ),
}));
vi.mock('../../../shared/src/journey/JourneyItemDetail', () => ({
  useJourneyDetail: () => ({ item: mockDetailItem, open: openDetail }),
  JourneyItemDetail: ({ onShare }: { onShare: () => void }) => (
    <div>
      Деталь записи
      <button onClick={onShare}>Поделиться записью</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockDetailItem = null;
  mockTotal = 0;
  mockPayload = null;
});

function renderSheet(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <JourneySheet onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('JourneySheet — список', () => {
  it('передаёт в JourneyView вёрстку своей площадки пропсом kit (а не чужую)', () => {
    KIT_PROBE.value = WEB_JOURNEY_KIT;
    renderSheet();
    expect(screen.getByTestId('journey-kit').textContent).toBe('true');
  });

  it('без выбранной записи показывает заголовок и ленту пути', () => {
    renderSheet();
    expect(screen.getByText('Мой путь')).toBeTruthy();
    expect(screen.getByText('Лента пути')).toBeTruthy();
  });

  it('без записей (total=0) кнопка «Поделиться» лентой не показывается', () => {
    mockTotal = 0;
    renderSheet();
    expect(screen.queryByText('Поделиться')).toBeNull();
  });

  it('с записями (total>0) кнопка «Поделиться» показывается и зовёт shareSummary', () => {
    mockTotal = 3;
    renderSheet();
    const share = screen.getByRole('button', { name: 'Поделиться' });
    // тихая ссылка, не залитая кнопка: залитой на листе ленты нет (b22-journey)
    expect(share.className).toContain('ds-link');
    fireEvent.click(share);
    expect(shareSummary).toHaveBeenCalled();
  });

  it('«Назад» зовёт onClose (через useHistorySheet); кнопка — ds-back в шапке ds-sheet-head (#906)', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const back = screen.getByText('← Назад');
    expect(back.className).toBe('ds-back');
    expect(back.parentElement!.classList.contains('ds-sheet-head')).toBe(true);
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('JourneySheet — деталь записи', () => {
  it('с выбранной записью показывает деталь вместо списка', () => {
    mockDetailItem = { id: 1 };
    renderSheet();
    expect(screen.getByText('Деталь записи')).toBeTruthy();
    expect(screen.queryByText('Мой путь')).toBeNull();
  });

  it('шаринг из детали зовёт shareItem с текущим item', () => {
    mockDetailItem = { id: 7 };
    renderSheet();
    fireEvent.click(screen.getByText('Поделиться записью'));
    expect(shareItem).toHaveBeenCalledWith({ id: 7 });
  });
});

describe('JourneySheet — шит шаринга', () => {
  it('без payload шит не рендерится', () => {
    mockPayload = null;
    renderSheet();
    expect(screen.queryByText('Скопировать текст')).toBeNull();
  });

  it('с payload рендерится ShareCardSheet с заголовком карточки', () => {
    mockPayload = { title: 'Мой путь', draw: vi.fn(), shareText: 't', filename: 'f.png', eventKind: 'journey_feed' };
    renderSheet();
    expect(screen.getAllByText('Мой путь').length).toBeGreaterThan(0);
  });
});
