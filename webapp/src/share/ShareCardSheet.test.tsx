// @vitest-environment jsdom
// ShareCardSheet (webapp) — общий шит шеринга. useShareCard уже покрыт своим
// тестом (shared/) — мокаем, проверяем вёрстку и проводку therapyNote
// (паритет с miniapp, В10 аудита 2026-08).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const shareMock = vi.fn().mockResolvedValue(undefined);
const copyMock = vi.fn().mockResolvedValue(undefined);
let hookState: {
  sharing: boolean;
  copied: boolean;
  failed: boolean;
  showText: boolean;
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

  it('therapyNote не передан — TherapyNote не показан', () => {
    renderSheet();
    expect(screen.queryByTestId('therapy-note')).toBeNull();
  });

  it('therapyNote=true — TherapyNote показан', () => {
    renderSheet({ therapyNote: true });
    expect(screen.getByTestId('therapy-note')).toBeTruthy();
  });

  it('therapyNote=false — TherapyNote не показан', () => {
    renderSheet({ therapyNote: false });
    expect(screen.queryByTestId('therapy-note')).toBeNull();
  });
});
