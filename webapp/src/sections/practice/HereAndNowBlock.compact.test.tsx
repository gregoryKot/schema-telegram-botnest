// @vitest-environment jsdom
// Телефонный вариант блока «Здесь и сейчас»: заголовок уходит в шапку
// страницы, дополнительные строки (пять шагов, контакты помощи) встают в тот
// же список после заземления и «Стопа», вместо «начать →» — шеврон.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HereAndNowBlock } from './HereAndNowBlock';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn().mockResolvedValue({ breathing: 0, grounding: 0, stop: 0 }),
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
  });

  it('extraRows идут в списке после заземления и «Стопа»; «начать →» нет', () => {
    renderBlock({ compact: true, extraRows: <div data-testid="extra">строка</div> });
    const stop = screen.getByText('Техника «Стоп»');
    const extra = screen.getByTestId('extra');
    expect(stop.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('начать →')).toBeNull();
  });

  it('десктопный вариант по умолчанию не меняется: заголовок и «начать →»', () => {
    renderBlock({});
    expect(screen.getByRole('heading', { name: 'Здесь и сейчас' })).toBeTruthy();
    expect(screen.getAllByText('начать →')).toHaveLength(2);
  });
});
