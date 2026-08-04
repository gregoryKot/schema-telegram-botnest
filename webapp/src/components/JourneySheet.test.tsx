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
  JourneyView: ({ onShareFeed }: { onShareFeed: () => void }) => (
    <div>
      Лента пути
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
  it('без выбранной записи показывает заголовок и ленту пути', () => {
    renderSheet();
    expect(screen.getByText('🧭 Мой путь')).toBeTruthy();
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
    fireEvent.click(screen.getByText('Поделиться'));
    expect(shareSummary).toHaveBeenCalled();
  });

  it('«Назад» зовёт onClose (через useHistorySheet)', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    fireEvent.click(screen.getByText('← Назад'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('JourneySheet — деталь записи', () => {
  it('с выбранной записью показывает деталь вместо списка', () => {
    mockDetailItem = { id: 1 };
    renderSheet();
    expect(screen.getByText('Деталь записи')).toBeTruthy();
    expect(screen.queryByText('🧭 Мой путь')).toBeNull();
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
