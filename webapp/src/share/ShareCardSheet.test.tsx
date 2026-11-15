// @vitest-environment jsdom
// ShareCardSheet (webapp) — общий шит шеринга. useShareCard уже покрыт своим
// тестом (shared/) — мокаем, проверяем вёрстку и проводку therapyNote:
// строка моста к терапевту (TherapyLine) с местом share.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const shareMock = vi.fn().mockResolvedValue(undefined);
const copyMock = vi.fn().mockResolvedValue(undefined);
let hookState: {
  sharing: boolean;
  copied: boolean;
  /** Картинка скачана вместо шэра — подпись кнопки берётся настоящая. */
  saved?: boolean;
  failed: boolean;
  showText: boolean;
  text: string;
  share: () => Promise<void>;
  copy: () => Promise<void>;
};

vi.mock('../../../shared/src/share/useShareCard', async () => {
  const { shareButtonLabel } = await import(
    '../../../shared/src/share/shareOutcome'
  );
  return {
    useShareCard: () => ({
      ...hookState,
      shareLabel: shareButtonLabel(hookState.sharing, !!hookState.saved),
    }),
  };
});
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

import { api } from '../api';
import { ShareCardSheet } from './ShareCardSheet';

const SELF_HELP = /^Приложение — самопомощь, не замена терапии\./;

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

function renderSheet(extra: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <ShareCardSheet {...baseProps()} {...extra} />
    </MemoryRouter>,
  );
}

describe('ShareCardSheet — therapyNote', () => {
  hookState = {
    sharing: false,
    copied: false,
    failed: false,
    showText: false,
    text: '',
    share: shareMock,
    copy: copyMock,
  };

  it('therapyNote не передан — строки нет, показ не считается', () => {
    renderSheet();
    expect(screen.queryByText(SELF_HELP)).toBeNull();
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('therapyNote=true — строка «самопомощь, не замена терапии», показ уходит с местом share', () => {
    renderSheet({ therapyNote: true });
    expect(screen.getByText(SELF_HELP)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
    expect(api.trackEvent).toHaveBeenCalledWith('therapy_nudge', { place: 'share', action: 'shown' });
  });

  it('therapyNote=false — строки нет', () => {
    renderSheet({ therapyNote: false });
    expect(screen.queryByText(SELF_HELP)).toBeNull();
  });
});

describe('ShareCardSheet — подпись главной кнопки', () => {
  function stateWith(over: Partial<typeof hookState>) {
    hookState = {
      sharing: false,
      copied: false,
      failed: false,
      showText: false,
      text: '',
      share: shareMock,
      copy: copyMock,
      ...over,
    };
  }

  it('обычное состояние — «Поделиться»', () => {
    stateWith({});
    renderSheet();
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });

  it('saved=true (шэра нет, картинка скачана) — «Картинка сохранена» с галочкой', () => {
    stateWith({ saved: true });
    renderSheet();
    expect(screen.getByText('Картинка сохранена')).toBeTruthy();
    expect(screen.queryByText('Поделиться')).toBeNull();
  });

  it('текст скопирован — галочка SVG в кнопке, а не глиф ✓; превью без белой рамки ds-card', () => {
    stateWith({ copied: true });
    const { container } = renderSheet();
    const btn = screen.getByText('Текст скопирован').closest('button')!;
    expect(btn.querySelector('svg')).toBeTruthy();
    expect(container.ownerDocument.body.textContent).not.toContain('✓');
    expect(container.ownerDocument.querySelector('.sd-canvas.ds-card')).toBeNull();
  });
});
