// @vitest-environment jsdom
// MyCardsSection — композиция: пусто = пусто (секции нет вообще), тап по
// строке открывает СУЩЕСТВУЮЩИЙ редактор (Schema/ModeIntroSheet) с нужным id,
// «Поделиться» открывает ShareCardSheet с этой карточкой.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MyCardsSection } from './MyCardsSection';
import type { MyCardItem } from './MyCardsList';

const ITEM: MyCardItem = {
  id: 'abandonment',
  name: 'Покинутость',
  subtitle: 'Отчуждение и отвержение',
  color: '#5aa8f7',
  excerpt: 'Когда не отвечают',
  cardFields: [{ label: 'Что включает', text: 'Когда не отвечают' }],
};

let mockLoading = false;
let mockItems: MyCardItem[] = [];
const mockReload = vi.fn();
vi.mock('./useMyCards', () => ({
  useMyCards: () => ({
    loading: mockLoading,
    items: mockItems,
    reload: mockReload,
  }),
}));

vi.mock('../SchemaIntroSheet', () => ({
  SchemaIntroSheet: ({
    schemaId,
    onClose,
  }: {
    schemaId: string;
    onClose: () => void;
  }) => (
    <div data-testid="schema-intro">
      {schemaId}
      <button aria-label="закрыть-редактор" onClick={onClose} />
    </div>
  ),
}));
vi.mock('../ModeIntroSheet', () => ({
  ModeIntroSheet: ({ modeId }: { modeId: string }) => (
    <div data-testid="mode-intro">{modeId}</div>
  ),
}));
vi.mock('../../share/ShareCardSheet', () => ({
  // Отрисовку канваса здесь не проверяем (canvas недоступен в jsdom) —
  // за неё отвечает noteCard.test.ts в shared/. Здесь только состав пропсов.
  ShareCardSheet: ({ title }: { title: string }) => (
    <div data-testid="share-sheet">{title}</div>
  ),
}));

afterEach(() => {
  cleanup();
  mockLoading = false;
  mockItems = [];
});

describe('MyCardsSection — пусто = пусто', () => {
  it('нет заполненных карточек → секции нет вообще', () => {
    mockLoading = false;
    mockItems = [];
    const { container } = render(<MyCardsSection kind="schema" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Мои карточки')).toBeNull();
  });

  it('идёт загрузка → секция смонтирована (скелетон), а не пусто', () => {
    mockLoading = true;
    mockItems = [];
    render(<MyCardsSection kind="schema" />);
    expect(screen.getByText('Мои карточки')).toBeTruthy();
  });
});

describe('MyCardsSection — открытие редактора', () => {
  it('схема: тап по строке открывает SchemaIntroSheet с нужным schemaId', () => {
    mockItems = [ITEM];
    render(<MyCardsSection kind="schema" />);
    fireEvent.click(screen.getByText('Покинутость'));
    expect(screen.getByTestId('schema-intro').textContent).toBe('abandonment');
  });

  it('режим: тап по строке открывает ModeIntroSheet с нужным modeId', () => {
    mockItems = [{ ...ITEM, id: 'demanding_critic' }];
    render(<MyCardsSection kind="mode" />);
    fireEvent.click(screen.getByText('Покинутость'));
    expect(screen.getByTestId('mode-intro').textContent).toBe(
      'demanding_critic',
    );
  });
});

describe('MyCardsSection — шаринг', () => {
  it('«Поделиться» открывает ShareCardSheet', () => {
    mockItems = [ITEM];
    render(<MyCardsSection kind="schema" />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(screen.getByTestId('share-sheet')).toBeTruthy();
    expect(screen.getByTestId('share-sheet').textContent).toBe(
      'Карточка схемы',
    );
  });
});

// Карточка правится в отдельном листе: без перезагрузки список остаётся со
// старой выжимкой, а только что заполненная карточка не появляется вовсе,
// пока не уйдёшь с вкладки и не вернёшься (правило read-after-write).
describe('MyCardsSection — список после правки', () => {
  it('закрытие редактора перезагружает список', () => {
    mockItems = [ITEM];
    render(<MyCardsSection kind="schema" />);
    fireEvent.click(screen.getByText('Покинутость'));
    expect(mockReload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('закрыть-редактор'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
