// @vitest-environment jsdom
// «Ещё»: каждая строка ведёт куда обещает; кабинет терапевта — только терапевту.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MoreSection } from './MoreSection';

const trackHomeTile = vi.hoisted(() => vi.fn());
vi.mock('./today/trackHomeTile', () => ({ trackHomeTile }));

vi.mock('../components/JourneySheet', () => ({
  JourneySheet: (p: { onClose: () => void }) => <div data-testid="journey"><button onClick={p.onClose}>закрыть путь</button></div>,
}));
vi.mock('../components/WhySheet', () => ({
  WhySheet: (p: { onClose: () => void; auto?: boolean }) => <div data-testid="why" data-auto={String(!!p.auto)}><button onClick={p.onClose}>закрыть зачем</button></div>,
}));

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
    for (const t of ['Зачем это всё', 'Мои паттерны', 'Практики', 'Мой путь', 'Тест на схемы', 'Настройки', 'Профиль', 'Мне очень плохо']) {
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
});
