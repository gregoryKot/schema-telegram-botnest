// @vitest-environment jsdom
// Текст продуктового лендинга живёт в src/articles/home-landing.content.ts —
// его же сервер вкладывает в #root главной для робота без JS (GEO.md). Здесь:
// у каждого пункта есть вид (сцена или знак и оттенок бумаги), адрес сайта практики в тексте тот
// же, что у трекинга клика, и ссылки внутри текста рисуются правильно.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { STEPS, FEATURES, TRUST, FAQ } from './productContent';
import { Rich } from './Rich';
import { AUTHOR_SITE } from './practiceLink';
import {
  HOME_AUTHOR_SITE,
  HOME_STEPS,
  HOME_FEATURES,
  HOME_TRUST,
  HOME_FAQ,
} from '../../../../src/articles/home-landing.content';

const trackPublicEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { trackPublicEvent: (...a: unknown[]) => trackPublicEvent(...a) },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('productContent: вид по id поверх общего текста', () => {
  it('каждый пункт текста получил вид, порядок сохранён', () => {
    expect(STEPS.map((s) => s.id)).toEqual(HOME_STEPS.map((s) => s.id));
    expect(FEATURES.map((f) => f.id)).toEqual(HOME_FEATURES.map((f) => f.id));
    expect(TRUST.map((t) => t.id)).toEqual(HOME_TRUST.map((t) => t.id));
    // Вид — картинка языка знаков и оттенок бумаги: у шага крупная сцена (LandingScenes),
    // у возможности и доверия — знак (PaperArt); оттенок — hue oklch, 0…360.
    for (const s of STEPS) expect(typeof s.Scene).toBe('function');
    for (const x of [...FEATURES, ...TRUST]) expect(typeof x.Art).toBe('function');
    for (const x of [...STEPS, ...FEATURES, ...TRUST]) expect(x.hue).toBeGreaterThanOrEqual(0);
    for (const x of [...STEPS, ...FEATURES, ...TRUST]) expect(x.hue).toBeLessThan(360);
    expect(STEPS.map((s) => s.num)).toEqual(['01', '02', '03']);
  });

  it('возможности: два крупных разворота со сценой, остальные — квадраты; соседи не одной бумаги', () => {
    expect(FEATURES.filter((f) => f.Scene).map((f) => f.id)).toEqual(['diary', 'modes']);
    for (const f of FEATURES.filter((x) => x.Scene)) expect(typeof f.Scene).toBe('function');
    const hues = FEATURES.map((f) => f.hue);
    expect(new Set(hues).size).toBe(hues.length);
    const stepHues = STEPS.map((s) => s.hue);
    expect(new Set(stepHues).size).toBe(stepHues.length);
    expect(FAQ).toBe(HOME_FAQ);
  });

  it('сайт практики в тексте = адрес, клик по которому считается', () => {
    expect(HOME_AUTHOR_SITE).toBe(AUTHOR_SITE);
    const links = HOME_FAQ.flatMap((f) => f.a).filter((p) => typeof p !== 'string');
    expect(links.map((l) => l.href)).toContain(AUTHOR_SITE);
  });
});

describe('Rich: текст со ссылками', () => {
  const parts = [
    'можно ',
    { text: 'поддержать', href: '/donate' },
    ' и ',
    { text: 'сайте практики', href: AUTHOR_SITE },
    '.',
  ];

  it('строки — текстом, внутренняя ссылка — в той же вкладке', () => {
    const { container } = render(<p><Rich parts={parts} /></p>);
    expect(container.textContent).toBe('можно поддержать и сайте практики.');
    const donate = screen.getByText('поддержать') as HTMLAnchorElement;
    expect(donate.getAttribute('href')).toBe('/donate');
    expect(donate.getAttribute('target')).toBeNull();
  });

  it('сайт практики — новая вкладка; клик считается с местом текста', () => {
    render(<p><Rich parts={parts} place="faq" /></p>);
    const site = screen.getByText('сайте практики') as HTMLAnchorElement;
    expect(site.getAttribute('target')).toBe('_blank');
    expect(site.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(site);
    expect(trackPublicEvent).toHaveBeenCalledWith('practice_link_click', { place: 'faq' });
    fireEvent.click(screen.getByText('поддержать'));
    expect(trackPublicEvent).toHaveBeenCalledTimes(1);
  });

  it('без места клик по сайту практики не считается', () => {
    render(<p><Rich parts={parts} /></p>);
    fireEvent.click(screen.getByText('сайте практики'));
    expect(trackPublicEvent).not.toHaveBeenCalled();
  });
});
