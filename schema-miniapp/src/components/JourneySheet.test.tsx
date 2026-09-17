// @vitest-environment jsdom
// JourneySheet (мини-апп) — обёртка «Мой путь» вокруг общих
// useJourney/JourneyView (0% покрытия после PR #511, храповик покрытия
// просел). Логика самой ленты уже покрыта тестами shared/, здесь мокаем
// shared-хуки/компоненты и проверяем оркестрацию мини-апп-обёртки:
// переключение список↔деталь, видимость SharePill (total>0), проброс
// шаринга, рендер шита шаринга при наличии payload и проброс onClose в
// BottomSheet. Парный тест — webapp/src/components/JourneySheet.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AddressFormContext } from '../utils/addressForm';
import { JourneySheet } from './JourneySheet';

const shareFeed = vi.fn();
const shareSummary = vi.fn();
const shareItem = vi.fn();
const closeShare = vi.fn();
const openDetail = vi.fn();
let mockDetailItem: unknown = null;
let mockTotal = 0;
let mockPayload: Record<string, unknown> | null = null;

vi.mock('./BottomSheet', () => ({
  BottomSheet: ({
    children,
    onClose,
  }: {
    children: ReactNode;
    onClose?: () => void;
  }) => (
    <div>
      <button onClick={onClose}>sheet-close</button>
      {children}
    </div>
  ),
}));

vi.mock('../api', () => ({ api: {} }));

vi.mock('../../../shared/src/journey/useJourney', () => ({
  useJourney: () => ({ items: [], stats: [], total: mockTotal, period: 'all' }),
  makeJourneyProps: () => ({
    deps: {},
    subtitle: () => '',
    fetchResult: vi.fn(),
    fetchDetail: vi.fn(),
  }),
}));
vi.mock('../../../shared/src/journey/journeyShare', () => ({
  useJourneyShare: () => ({
    payload: mockPayload,
    close: closeShare,
    shareFeed,
    shareSummary,
    shareItem,
  }),
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
  JourneyItemDetail: () => <div>Деталь записи (не использовано напрямую)</div>,
}));
vi.mock('../../../shared/src/journey/JourneyDetailPane', () => ({
  JourneyDetailPane: ({
    detail,
    onShare,
  }: {
    detail: { item: unknown };
    onShare: (item: unknown) => void;
  }) => (
    <div>
      Деталь записи
      <button onClick={() => onShare(detail.item)}>Поделиться записью</button>
    </div>
  ),
}));
vi.mock('../../../shared/src/journey/journeyDelete', () => ({
  useJourneyDelete: () => ({}),
}));
vi.mock('../share/ShareCardSheet', () => ({
  ShareCardSheet: () => <div>Шит шаринга</div>,
}));
vi.mock('../share/SharePill', () => ({
  SharePill: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>Поделиться</button>
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
    <AddressFormContext.Provider value={{ form: 'ty', setForm: () => {} }}>
      <JourneySheet onClose={onClose} />
    </AddressFormContext.Provider>,
  );
}

describe('JourneySheet (мини-апп) — список', () => {
  it('без выбранной записи показывает заголовок и ленту пути', () => {
    renderSheet();
    expect(screen.getByText('Мой путь')).toBeTruthy();
    expect(screen.getByText('Лента пути')).toBeTruthy();
  });

  it('без записей (total=0) SharePill не показывается', () => {
    mockTotal = 0;
    renderSheet();
    expect(screen.queryByText('Поделиться')).toBeNull();
  });

  it('с записями (total>0) SharePill показывается и зовёт shareSummary', () => {
    mockTotal = 3;
    renderSheet();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(shareSummary).toHaveBeenCalled();
  });

  it('«sheet-close» (BottomSheet) зовёт onClose', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    fireEvent.click(screen.getByText('sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('JourneySheet (мини-апп) — деталь записи', () => {
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

describe('JourneySheet (мини-апп) — шит шаринга', () => {
  it('без payload шит не рендерится', () => {
    mockPayload = null;
    renderSheet();
    expect(screen.queryByText('Шит шаринга')).toBeNull();
  });

  it('с payload рендерится ShareCardSheet', () => {
    mockPayload = {
      title: 'Мой путь',
      draw: vi.fn(),
      shareText: 't',
      filename: 'f.png',
      eventKind: 'journey_feed',
    };
    renderSheet();
    expect(screen.getByText('Шит шаринга')).toBeTruthy();
  });
});
