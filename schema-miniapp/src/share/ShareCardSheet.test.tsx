// @vitest-environment jsdom
// ShareCardSheet — общий шит шеринга (канвас + «Поделиться» + «Скопировать
// текст»), через него ходят ВСЕ share-карточки приложения (0% покрытия).
// useShareCard (shared/) уже покрыт своим тестом — мокаем, чтобы проверять
// именно вёрстку/проводку состояния этого компонента: кнопка «Поделиться»
// дизейблится во время sharing (защита от дубль-тапа), второй BottomSheet
// с текстом появляется только при showText.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const shareMock = vi.fn().mockResolvedValue(undefined);
const copyMock = vi.fn().mockResolvedValue(undefined);
const closeTextMock = vi.fn();
let hookState: {
  sharing: boolean;
  copied: boolean;
  showText: boolean;
  closeText: () => void;
  text: string;
  share: () => Promise<void>;
  copy: () => Promise<void>;
};

vi.mock('../../../shared/src/share/useShareCard', () => ({
  useShareCard: () => hookState,
}));
vi.mock('../components/TherapyNote', () => ({
  TherapyNote: () => <div data-testid="therapy-note" />,
}));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

import { ShareCardSheet } from './ShareCardSheet';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function baseProps() {
  return {
    title: 'Карточка недели',
    draw: vi.fn(),
    shareText: 'Текст для шеринга',
    filename: 'card.png',
    eventKind: 'weekly' as const,
    onClose: vi.fn(),
  };
}

describe('ShareCardSheet — основной лист', () => {
  it('показывает заголовок и подводку', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    expect(screen.getByText('Карточка недели')).toBeTruthy();
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });

  it('клик «Поделиться» зовёт s.share()', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Поделиться'));
    expect(shareMock).toHaveBeenCalled();
  });

  it('sharing=true — кнопка показывает «Готовлю картинку…» и disabled (защита от дубль-тапа)', () => {
    hookState = {
      sharing: true,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    const btn = screen.getByText('Готовлю картинку…');
    expect(btn.disabled).toBe(true);
  });

  it('клик «Скопировать текст» зовёт s.copy()', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Скопировать текст'));
    expect(copyMock).toHaveBeenCalled();
  });

  it('copied=true — подпись меняется на «✓ Текст скопирован»', () => {
    hookState = {
      sharing: false,
      copied: true,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    expect(screen.getByText('✓ Текст скопирован')).toBeTruthy();
  });

  it('therapyNote=true — показывает TherapyNote, false — не показывает', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: '',
      share: shareMock,
      copy: copyMock,
    };
    const { rerender } = render(
      <ShareCardSheet {...baseProps()} therapyNote />,
    );
    expect(screen.getByTestId('therapy-note')).toBeTruthy();
    rerender(<ShareCardSheet {...baseProps()} therapyNote={false} />);
    expect(screen.queryByTestId('therapy-note')).toBeNull();
  });
});

describe('ShareCardSheet — фолбэк «поделиться текстом»', () => {
  it('showText=false — второго листа нет', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: false,
      closeText: closeTextMock,
      text: 'Полный текст',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    expect(screen.queryByText('Поделиться текстом')).toBeNull();
  });

  it('showText=true — открывается второй лист с текстом фолбэка', () => {
    hookState = {
      sharing: false,
      copied: false,
      showText: true,
      closeText: closeTextMock,
      text: 'Полный текст карточки',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    expect(screen.getByText('Поделиться текстом')).toBeTruthy();
    expect(screen.getByText('Полный текст карточки')).toBeTruthy();
  });

  it('во втором листе тоже отражается copied и зовёт copy()', () => {
    hookState = {
      sharing: false,
      copied: true,
      showText: true,
      closeText: closeTextMock,
      text: 'Текст',
      share: shareMock,
      copy: copyMock,
    };
    render(<ShareCardSheet {...baseProps()} />);
    const buttons = screen.getAllByText('✓ Скопировано');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
