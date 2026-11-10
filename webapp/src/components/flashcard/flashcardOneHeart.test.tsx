// @vitest-environment jsdom
// Одно сердце рядом (ревью g4 r5, раздел b12 APP_2026-11.md): кризисная карточка несёт знак Heart, но
//  • в шагах «Мне плохо» (отклик и шаг действия) рядом — герой шага с тем же Heart, но только в развороте ≥1024 →
//    знак карточки прячет тот же @media flashcard.css, что показывает героя (--crisis-card-art: none); на телефоне и
//    планшете героя нет — знак у карточки остаётся (ревью g4 r6: безусловный signless терял его на 390 и 768);
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
import { CRISIS_CARD_STYLE } from '../../../../shared/src/components/crisisCardStyle';
import { readCss } from '../../styles/cssRules.test-helpers';

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

  it('шаг 2: карточка от детекции — со своим знаком в разметке, обе линии на месте; Heart героя шага — рядом', () => {
    toResponse();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), { target: { value: CRISIS } });
    expect(cardSign(card())).not.toBeNull();
    for (const h of CRISIS_HOTLINES) expect(screen.getByText(h.display)).toBeTruthy();
    expect(document.querySelector('.sk-fc-spread .sk-fc-step > .pa-sheet-art svg')).not.toBeNull();
    expect(card().closest('.sk-fc-spread')).not.toBeNull();
  });

  it('шаг 4: то же у поля действия', () => {
    toResponse();
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), { target: { value: CRISIS } });
    expect(cardSign(card())).not.toBeNull();
    expect(card().closest('.sk-fc-spread')!.querySelector('.sk-fc-step > .pa-sheet-art')).not.toBeNull();
  });

  // Видимость — CSS (jsdom его не исполняет): герой шага и знак карточки решает один и тот же @media. Знак карточки
  // гаснет только там, где герой показан; на телефоне (390) и планшете (768) героя нет — знак виден.
  it('знак карточки гаснет ровно в @media, где виден Heart героя шага (≥1024), и нигде больше', () => {
    const css = readCss('flashcard.css');
    const heroOn = css.filter((r) => r.selectors.includes('.sk-fc .pa-sheet.sk-fc-step > .pa-sheet-art') && /display:\s*flex/.test(r.body));
    const signOff = css.filter((r) => r.selectors.some((s) => s.includes('[data-crisis-card]')) && /--crisis-card-art:\s*none/.test(r.body));
    expect(heroOn).toHaveLength(1);
    expect(heroOn[0].media).toMatch(/min-width:\s*1024px/);
    expect(signOff.map((r) => r.media)).toEqual([heroOn[0].media]);
    expect(signOff[0].selectors.join()).toContain('.sk-fc-step > .pa-sheet-art');
    expect(css.find((r) => r.media === '' && r.selectors.includes('.sk-fc .pa-sheet.sk-fc-step > .pa-sheet-art'))?.body).toMatch(/display:\s*none/);
    // Переменная доходит до знака: знак берёт display из --crisis-card-art, по умолчанию его ставит карточка
    // (inline-flex, инлайном), а экран гасит его у шапки — первого ребёнка карточки, где знак и лежит.
    expect(CRISIS_CARD_STYLE.art.display).toBe('var(--crisis-card-art)');
    expect(signOff[0].selectors.join()).toMatch(/\[data-crisis-card\] > :first-child$/);
    render(<CrisisCard surface="x" />);
    expect(card().getAttribute('style')).toContain('--crisis-card-art: inline-flex');
    expect(cardSign(card())).not.toBeNull(); // знак — в первом ребёнке карточки: переопределение у шапки до него доходит
  });

  it('телефон: кризисная карточка шага — не signless (знак в разметке без героя рядом)', () => {
    toResponse();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), { target: { value: CRISIS } });
    const art = card().firstElementChild!.querySelector(':scope > span[aria-hidden="true"]') as HTMLElement;
    expect(art.querySelector('svg')).not.toBeNull();
    expect(art.closest('.sk-fc-step')).toBeNull();
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
