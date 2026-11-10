// @vitest-environment jsdom
// Одно сердце рядом (ревью g4 r5, раздел b12 APP_2026-11.md): кризисная карточка несёт знак Heart, но
//  • в шагах «Мне плохо» (отклик и шаг действия) рядом — герой шага с тем же Heart (на компьютере) → карточка signless;
//  • в разборе «Что случилось» под карточкой от детекции — строка «Тяжело прямо сейчас →» с сердцем → строка без
//    своего, пока карточка на экране; без карточки — с сердцем (контрольный образец).
// Номера и сама карточка не трогаются: обе линии на месте (правило №7).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaFlashcard } from '../SchemaFlashcard';
import { CrisisCard } from '../CrisisCard';
import { CaseSupportBlock } from '../caseFlow/CaseSupportFoot';
import { CRISIS_HOTLINES } from '../../../../shared/src/utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: { getFlashcards: vi.fn(() => Promise.resolve([])), createFlashcard: vi.fn(() => Promise.resolve({})), trackEvent: vi.fn() },
}));

afterEach(cleanup);

const CRISIS = 'не хочу жить';
/** Знак у заголовка карточки: span[aria-hidden] первым в её шапке (CrisisCardView, art). */
const cardSign = (card: Element) => card.firstElementChild?.querySelector(':scope > span[aria-hidden="true"] svg') ?? null;
const card = () => document.querySelector('[data-crisis-card]')!;

describe('«Мне плохо»: карточка шага без второго сердца', () => {
  const toResponse = () => {
    render(<MemoryRouter><SchemaFlashcard onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Стало чуть лучше – разобраться →'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
  };

  it('шаг 2: карточка от детекции — без знака, обе линии на месте; Heart — у героя шага', () => {
    toResponse();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), { target: { value: CRISIS } });
    expect(cardSign(card())).toBeNull();
    for (const h of CRISIS_HOTLINES) expect(screen.getByText(h.display)).toBeTruthy();
    expect(document.querySelector('.sk-fc-step .pa-sheet-art svg')).not.toBeNull();
  });

  it('шаг 4: то же у поля действия', () => {
    toResponse();
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), { target: { value: CRISIS } });
    expect(cardSign(card())).toBeNull();
  });

  it('контрольный образец: карточка по умолчанию знак несёт — сверка его видит', () => {
    render(<CrisisCard surface="x" />);
    expect(cardSign(card())).not.toBeNull();
  });
});

describe('разбор «Что случилось»: сердце у карточки, строка без своего', () => {
  const link = () => screen.getByText('Тяжело прямо сейчас →').closest('button')!;

  it('карточка от детекции на экране — у «Тяжело прямо сейчас →» сердца нет, у карточки есть', () => {
    render(<CaseSupportBlock crisis onHardNow={vi.fn()} />);
    expect(cardSign(card())).not.toBeNull();
    expect(link().querySelector('.cq-link-lead')).toBeNull();
  });

  it('контрольный образец: без карточки строка с сердцем', () => {
    render(<CaseSupportBlock crisis={false} onHardNow={vi.fn()} />);
    expect(document.querySelector('[data-crisis-card]')).toBeNull();
    expect(link().querySelector('.cq-link-lead svg')).not.toBeNull();
  });
});
