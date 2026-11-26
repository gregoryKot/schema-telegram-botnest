// @vitest-environment jsdom
// Герой результата теста над первой группой близкой бумаги — белый лист (ревью g5 r3, resultHeroLook) — через шов
// (правило №14): настоящий YSQTestSheet считает результат из сохранённых ответов, YsqResultHero ставит класс.
// Первая группа «Привязанность» (бумага теста) — `pa-sheet--white`; первая группа «Выражение» — бумага теста.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { YSQTestSheet } from './YSQTestSheet';
import { QUESTIONS, SCHEMAS, YSQ_RESULT_KEY } from '../hooks/useYsqTest';

vi.mock('../api', () => ({
  api: {
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    saveYsqProgress: vi.fn().mockResolvedValue(undefined),
    saveYsqResult: vi.fn().mockResolvedValue(undefined),
    deleteYsqProgress: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
    trackPublicEvent: vi.fn(),
  },
}));

/** Ответы, где выражена одна схема первой по порядку с этой потребностью: её вопросы — «6», остальные — «1». */
function seedOnly(needId: string) {
  const schema = SCHEMAS.find((s) => s.needId === needId)!;
  const answers = QUESTIONS.map((_, i) => (schema.questions.includes(i + 1) ? 6 : 1));
  localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ date: new Date().toISOString(), answers }));
}

async function resultHero(): Promise<Element> {
  render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/schemas']}><YSQTestSheet onClose={vi.fn()} /></MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return waitFor(() => {
    const hero = document.querySelector('.ss-res-hero');
    expect(hero).not.toBeNull();
    return hero!;
  });
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('YSQTestSheet — герой результата над первой группой', () => {
  it('первая группа «Привязанность» (та же бумага) — белый лист с тенью-слоем', async () => {
    seedOnly('attachment');
    expect((await resultHero()).classList.contains('pa-sheet--white')).toBe(true);
  });

  it('первая группа «Выражение» (далёкая бумага) — герой на бумаге теста', async () => {
    seedOnly('expression');
    expect((await resultHero()).classList.contains('pa-sheet--white')).toBe(false);
  });
});
