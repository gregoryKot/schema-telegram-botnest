// @vitest-environment jsdom
// Телефонный вариант блока «Здесь и сейчас»: заголовок уходит в шапку
// страницы, под вводной — ссылка «Важное о самопомощи», кризисные строки
// («Мне плохо», контакты помощи) встают после квадратов заземления и «Стопа».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HereAndNowBlock } from './HereAndNowBlock';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn().mockResolvedValue({ breathing: 0, grounding: 0, stop: 0 }),
    getFlashcards: vi.fn().mockResolvedValue([]),
    recordPracticeSession: vi.fn(),
  },
}));
vi.mock('../../components/practice/BreathingCard', () => ({
  BreathingCard: () => <div data-testid="breathing" />,
}));

afterEach(cleanup);

const renderBlock = (props: Parameters<typeof HereAndNowBlock>[0]) =>
  render(<MemoryRouter><HereAndNowBlock {...props} /></MemoryRouter>);

describe('HereAndNowBlock compact', () => {
  it('без заголовка h3, абзац короткий, дыхание на месте', () => {
    renderBlock({ compact: true });
    expect(screen.queryByRole('heading', { name: 'Здесь и сейчас' })).toBeNull();
    expect(screen.getByTestId('breathing')).toBeTruthy();
    expect(screen.getByText(/Три коротких практики самопомощи/)).toBeTruthy();
    expect(screen.queryByText(/счётчик покажет/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Важное о самопомощи' })).toBeTruthy();
  });

  it('extraRows идут после квадратов заземления и «Стопа»; «начать →» нет', () => {
    renderBlock({ compact: true, extraRows: <div data-testid="extra">строка</div> });
    const stop = screen.getByText('Техника «Стоп»');
    const extra = screen.getByTestId('extra');
    expect(stop.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('начать →')).toBeNull();
  });

  it('компьютер: заголовок блока, три квадрата с «Мне плохо» (onSos), «Важное» — в шапке, не здесь', () => {
    renderBlock({ onSos: () => {} });
    expect(screen.getByRole('heading', { name: 'Здесь и сейчас' })).toBeTruthy();
    expect(document.querySelectorAll('.cp-squares--3 > .cp-sq')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Важное о самопомощи' })).toBeNull();
  });
});
