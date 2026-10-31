// @vitest-environment jsdom
// «Ещё»: каждая строка ведёт куда обещает; кабинет терапевта — только терапевту.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MoreSection } from './MoreSection';

const trackHomeTile = vi.hoisted(() => vi.fn());
const trackNudge = vi.hoisted(() => vi.fn());
vi.mock('../components/therapy/trackTherapyNudge', () => ({ trackTherapyNudge: trackNudge }));
vi.mock('./today/trackHomeTile', () => ({ trackHomeTile }));

vi.mock('../components/JourneySheet', () => ({
  JourneySheet: (p: { onClose: () => void }) => <div data-testid="journey"><button onClick={p.onClose}>закрыть путь</button></div>,
}));
vi.mock('../components/WhySheet', () => ({
  WhySheet: (p: { onClose: () => void; auto?: boolean }) => <div data-testid="why" data-auto={String(!!p.auto)}><button onClick={p.onClose}>закрыть зачем</button></div>,
}));

beforeEach(() => { localStorage.clear(); trackNudge.mockClear(); });
afterEach(cleanup);

function setup(userRole: 'CLIENT' | 'THERAPIST' = 'CLIENT') {
  const h = {
    onNavigate: vi.fn(), onOpenSchema: vi.fn(), onOpenAdvanced: vi.fn(), onOpenTherapistCabinet: vi.fn(),
  };
  render(<MemoryRouter><MoreSection {...h} userRole={userRole} /></MemoryRouter>);
  return h;
}
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });

describe('MoreSection', () => {
  it('заголовок и все строки списка', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Всё остальное');
    for (const t of ['Зачем это всё', 'Мои паттерны', 'Практики', 'Мой путь', 'Поговорить с кем-то', 'Тест на схемы', 'Настройки', 'Профиль', 'Мне очень плохо']) {
      expect(row(t)).toBeTruthy();
    }
  });

  it('переходы: паттерны, практики, профиль (в нём же терапевт) — в свои разделы; «Мне очень плохо» — в практики', () => {
    const h = setup();
    fireEvent.click(row('Мои паттерны'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('schemas');
    fireEvent.click(row('Практики'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('practice');
    fireEvent.click(row('Профиль'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('profile');
    fireEvent.click(row('Мне очень плохо'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('practice');
  });

  it('тест на схемы запускается сразу, настройки открываются', () => {
    const h = setup();
    fireEvent.click(row('Тест на схемы'));
    expect(h.onOpenSchema).toHaveBeenCalledWith({ startTest: true });
    fireEvent.click(row('Настройки'));
    expect(h.onOpenAdvanced).toHaveBeenCalledTimes(1);
  });

  it('«Зачем это всё» и «Мой путь» открывают свои листы и закрываются', () => {
    setup();
    fireEvent.click(row('Зачем это всё'));
    expect(trackHomeTile).toHaveBeenCalledWith('why');
    expect(screen.getByTestId('why').getAttribute('data-auto')).toBe('false');
    fireEvent.click(screen.getByText('закрыть зачем'));
    expect(screen.queryByTestId('why')).toBeNull();
    fireEvent.click(row('Мой путь'));
    expect(screen.getByTestId('journey')).toBeTruthy();
    fireEvent.click(screen.getByText('закрыть путь'));
    expect(screen.queryByTestId('journey')).toBeNull();
  });

  it('строки «Терапевт» нет: он внутри «Профиля», подпись об этом говорит', () => {
    setup();
    expect(screen.queryByRole('button', { name: /^Терапевт/ })).toBeNull();
    expect(row('Профиль').textContent).toContain('Портрет, терапевт, ближайшая встреча');
  });

  it('кабинет терапевта: у клиента строки нет, у терапевта есть и ведёт в кабинет', () => {
    setup('CLIENT');
    expect(screen.queryByRole('button', { name: /Кабинет терапевта/ })).toBeNull();
    cleanup();
    const h = setup('THERAPIST');
    fireEvent.click(row('Кабинет терапевта'));
    expect(h.onOpenTherapistCabinet).toHaveBeenCalledTimes(1);
  });

  it('«Поговорить с кем-то» стоит сразу после «Мой путь» и открывает лист', () => {
    setup();
    const titles = screen.getAllByRole('button').map(b => b.textContent ?? '');
    const at = titles.findIndex(t => t.startsWith('Мой путь'));
    expect(titles[at + 1]).toMatch(/^Поговорить с кем-то/);
    expect(row('Поговорить с кем-то').textContent).toContain('Встреча с автором приложения');
    fireEvent.click(row('Поговорить с кем-то'));
    expect(trackNudge).toHaveBeenCalledWith('more', 'open', undefined);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  });

  it('терапевт подключён: строка «Написать терапевту» — ссылка на него, событие write', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    setup();
    expect(screen.queryByRole('button', { name: /^Поговорить с кем-то/ })).toBeNull();
    const link = screen.getByRole('link', { name: /^Написать терапевту/ });
    expect(link.getAttribute('href')).toBe('tg://user?id=42');
    expect(link.textContent).toContain('Связь с терапевтом');
    fireEvent.click(link);
    expect(trackNudge).toHaveBeenCalledWith('more', 'write', undefined);
  });

  it('пользователю-терапевту строки нет', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    setup();
    expect(screen.queryByText('Поговорить с кем-то')).toBeNull();
    expect(screen.queryByText(/Написать терапевту/)).toBeNull();
    cleanup();
    localStorage.clear();
    setup('THERAPIST');
    expect(screen.queryByText('Поговорить с кем-то')).toBeNull();
  });
});
